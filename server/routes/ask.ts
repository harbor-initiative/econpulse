/**
 * `/ask` — one question, answered.
 *
 * Two paths, and the split is the whole design. A name goes to the index. A
 * question goes to the model, which may only name a place and pick a measure;
 * the index resolves the name afterwards. A model that cannot answer gets asked
 * which place, because guessing produced Bell County for "the Liberty Bell".
 */


import type { ServerResponse } from "node:http";
import { lookupZip, searchPlaces } from "../store.ts";
import { db, meta } from "../lib/runtime.ts";
import { redirect, send } from "../lib/http.ts";
import { METRICS, REPORT_ORDER } from "../lib/metrics.ts";
import { buildPanels, contextFor, panelFor } from "../lib/panels.ts";
import { factDateSpan } from "../lib/freshness.ts";
import { parseLocally, parseQuestion } from "../ask.ts";
import { isQuestion } from "../lib/rules.ts";
import { report } from "../views/report.ts";
import { searchResults } from "../views/search.ts";
import { askCard } from "../views/ask.ts";
import { askNeedMetric, askNeedPlace } from "../views/states.ts";

export async function routeAsk(url: URL, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== "/ask") return false;

  const question = (url.searchParams.get("q") ?? "").trim();
  if (!question) {
    redirect(res, "/");
    return true;
  }

  if (/^\d{5}$/.test(question)) {
    const county = lookupZip(db, question);
    if (county) {
      redirect(res, `/p/${county.geoid}?zip=${question}`);
      return true;
    }
    send(res, 404, askNeedPlace(question, null, [
      "Try a county name instead", "20744", "Is rent going up in Austin",
    ]));
    return true;
  }

  const menu = Object.entries(METRICS).map(([id, spec]) => ({ id, label: spec.label }));

  // A question goes to the model. A name goes to the index. Mixing the two is
  // how "the Liberty Bell" became Bell County, Texas.
  let parsed = isQuestion(question)
    ? await parseQuestion(db, question, menu)
    : parseLocally(db, question);

  // A name the index could not place may still be a nickname. Ask the model only
  // after the index has failed.
  if (!parsed.place && !isQuestion(question) && process.env.OPENROUTER_API_KEY) {
    parsed = await parseQuestion(db, question, menu);
  }

  let place = parsed.place;
  let metric = parsed.metric;

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
    const examples = ["Is rent going up in Austin", "Population of Cook County", "Federal money in Philadelphia"];
    send(res, 404, askNeedPlace(question, metric ? (METRICS[metric]?.label ?? metric) : null, examples));
    return true;
  }

  const notice: string | undefined = undefined;
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
