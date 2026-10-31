/**
 * `/ask` — one question, answered.
 *
 * Two paths, and the split is the whole design. A name goes to the index. A
 * question goes to the model, which may only name a place and pick a measure;
 * the index resolves the name afterwards. A model that cannot answer gets asked
 * which place, because guessing produced Bell County for "the Liberty Bell".
 *
 * Six states come out of this, and each names the part that is missing: the
 * card, a place, a measure, a model that is busy, an answer the box could not
 * read, and a place that is not in the file.
 */


import type { IncomingMessage, ServerResponse } from "node:http";
import { lookupZip, searchPlaces } from "../store.ts";
import { db, meta } from "../lib/runtime.ts";
import { redirect, send } from "../lib/http.ts";
import { METRICS, REPORT_ORDER } from "../lib/metrics.ts";
import { buildPanels, contextFor, panelFor } from "../lib/panels.ts";
import { factDateSpan } from "../lib/freshness.ts";
import { parseLocally, parseQuestion } from "../ask.ts";
import { isQuestion } from "../lib/rules.ts";
import { isModelUnavailable, type ModelOutcome } from "../lib/model.ts";
import { report } from "../views/report.ts";
import { searchResults } from "../views/search.ts";
import { askCard } from "../views/ask.ts";
import { allow, clientKey } from "../lib/ratelimit.ts";
import { askModelBusy, askNeedMetric, askNeedPlace, askNoMatch, askRateLimited, askUnreadable } from "../views/states.ts";

export async function routeAsk(url: URL, res: ServerResponse, req?: IncomingMessage): Promise<boolean> {
  if (url.pathname !== "/ask") return false;

  const question = (url.searchParams.get("q") ?? "").trim();
  if (!question) {
    redirect(res, "/");
    return true;
  }

  const menu = Object.entries(METRICS).map(([id, spec]) => ({ id, label: spec.label }));
  const dataVersion = meta["data.version"] ?? "?";
  const examples = ["Is rent going up in Austin", "Population of Cook County", "Federal money in Philadelphia"];

  if (/^\d{5}$/.test(question)) {
    const county = lookupZip(db, question);
    if (county) {
      redirect(res, `/p/${county.geoid}?zip=${question}`);
      return true;
    }
    // A ZIP that resolves to no county is a place the file does not carry.
    send(res, 404, askNoMatch(question, examples));
    return true;
  }

  // The ceiling sits here: after the redirects that cost nothing, before
  // anything that can reach the model.
  const decision = allow(clientKey(req?.headers ?? {}, req?.socket.remoteAddress));
  if (!decision.allowed) {
    res.setHeader("retry-after", String(decision.retryAfter));
    send(res, 429, askRateLimited(question, decision.retryAfter, decision.limit ?? "client"));
    return true;
  }

  // A question goes to the model. A name goes to the index. Mixing the two is
  // how "the Liberty Bell" became Bell County, Texas.
  let parsed = isQuestion(question)
    ? await parseQuestion(db, question, menu, dataVersion)
    : parseLocally(db, question);

  // A name the index could not place may still be a nickname. Ask the model only
  // after the index has failed.
  if (!parsed.place && !isQuestion(question) && process.env.OPENROUTER_API_KEY) {
    parsed = await parseQuestion(db, question, menu, dataVersion);
  }

  // A model that could not be reached is a busy network, not a question the box
  // read and rejected. Answer from the grammar where it can, and say why;
  // otherwise show the busy state in place of "which place".
  let notice: string | undefined;
  if (isModelUnavailable(parsed.model)) {
    const local = parseLocally(db, question);
    if (local.place) {
      parsed = local;
      notice = "The model is unavailable right now. This answer comes from the local vocabulary.";
    } else {
      send(res, 503, askModelBusy(question, examples));
      return true;
    }
  }

  const place = parsed.place;
  const metric = parsed.metric;

  // The model answered, but the answer carried no place and no measure. The
  // network worked; the box could not read what came back. That is a different
  // page from a busy network, because trying again can change this one.
  if (!place && modelAnsweredNothing(parsed.model)) {
    send(res, 502, askUnreadable(question, examples));
    return true;
  }

  if (!place) {
    const candidates = searchPlaces(db, question);
    if (candidates.length > 1) {
      send(res, 200, searchResults(question, candidates));
      return true;
    }
    if (candidates.length === 1 && candidates[0]) {
      redirect(res, `/p/${candidates[0].geoid}`);
      return true;
    }
    // Neither the index nor a model produced a place, and no measure was read.
    // The place is not in this release.
    if (!metric && !modelWasAsked(parsed.model)) {
      send(res, 404, askNoMatch(question, examples));
      return true;
    }
    send(res, 404, askNeedPlace(question, metric ? (METRICS[metric]?.label ?? metric) : null, examples));
    return true;
  }

  const ctx = contextFor(place);

  if (!metric) {
    if (ctx.available.size > 1) {
      send(res, 200, report(place, buildPanels(place), meta, undefined, factDateSpan(db)));
      return true;
    }
    const offered = REPORT_ORDER
      .map((m) => panelFor(place, m, ctx.available, ctx.county, ctx.countyMetrics))
      .filter((p) => p.fact)
      .map((p) => ({ id: p.metric, label: METRICS[p.metric]?.label ?? p.label }));
    send(res, 200, askNeedMetric(question, place, offered));
    return true;
  }

  const panel = panelFor(place, metric, ctx.available, ctx.county, ctx.countyMetrics);
  if (!panel.fact) {
    const offered = REPORT_ORDER
      .filter((m) => ctx.available.has(m))
      .map((m) => ({ id: m, label: METRICS[m]?.label ?? m }));
    send(res, 200, askNeedMetric(question, place, offered));
    return true;
  }

  const followUps = REPORT_ORDER
    .filter((m) => m !== metric)
    .filter((m) => panelFor(place, m, ctx.available, ctx.county, ctx.countyMetrics).fact)
    .slice(0, 3)
    .map((m) => ({
      label: METRICS[m]?.label ?? m,
      href: `/ask?q=${encodeURIComponent(`${METRICS[m]?.label ?? m} in ${place?.name}`)}`,
    }));

  send(res, 200, askCard(question, place, panel, followUps, notice));
  return true;
}

/**
 * The model answered, but the answer carried no place and no measure.
 *
 * Two shapes reach here. `unreadable` is a body with no JSON. An `ok` or cached
 * answer with both fields null is the same failure with valid JSON, and it reads
 * the same to a person.
 */
function modelAnsweredNothing(outcome: ModelOutcome | undefined): boolean {
  if (!outcome) return false;
  if (outcome.status === "unreadable") return true;
  if (outcome.status !== "ok" && outcome.status !== "cached") return false;
  return !outcome.answer?.placeName && !outcome.answer?.metric;
}

/** True when a model was in the loop at all. `off` means no key was set. */
function modelWasAsked(outcome: ModelOutcome | undefined): boolean {
  return outcome !== undefined && outcome.status !== "off";
}
