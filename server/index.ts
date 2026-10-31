#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  openStore, storePath, getPlace, searchPlaces, series, metricsFor,
  countyForPlace, counts, buildMeta, type Place, type Fact,
} from "./store.ts";
import { home, searchResults, report, status, shell, askCard, askNeedPlace, askNeedMetric, type Panel } from "./view.ts";
import { parseQuestion, askModel } from "./ask.ts";

/**
 * The web server.
 *
 * One box, two kinds of answer. A place gets the full report; a question gets
 * one card. The question is parsed locally first, so the whole thing works with
 * no key and no network. A model is only consulted when the local parse fails,
 * and it may only choose from a menu.
 */

const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? "127.0.0.1";

interface MetricSpec { label: string; compare: boolean; countyFallback: boolean }

const METRICS: Record<string, MetricSpec> = {
  population: { label: "Population", compare: false, countyFallback: false },
  unemployment_rate: { label: "Unemployment", compare: true, countyFallback: true },
  median_gross_rent: { label: "Median gross rent", compare: true, countyFallback: false },
  median_household_income: { label: "Median household income", compare: true, countyFallback: false },
  median_home_value: { label: "Median home value", compare: true, countyFallback: false },
  gdp: { label: "Output", compare: false, countyFallback: true },
  federal_obligations: { label: "Federal obligations", compare: false, countyFallback: true },
  poverty_rate: { label: "Poverty rate", compare: true, countyFallback: false },
  bachelors_or_higher: { label: "Bachelor's degree or higher", compare: true, countyFallback: false },
  median_age: { label: "Median age", compare: true, countyFallback: false },
  labor_force_participation_rate: { label: "Labor force participation", compare: true, countyFallback: false },
  unemployment_rate_acs: { label: "Unemployment rate, five-year average", compare: false, countyFallback: false },
};

/** The order the one-page report uses. */
const REPORT_ORDER = ["population", "unemployment_rate", "median_gross_rent", "gdp", "federal_obligations"];

const db = openStore(storePath());
const meta = buildMeta(db);

function panelFor(
  place: Place,
  metric: string,
  available: Set<string>,
  county: Place | null,
  countyMetrics: Set<string>,
): Panel {
  const spec = METRICS[metric] ?? { label: metric, compare: true, countyFallback: false };

  let sourceGeoid = place.geoid;
  let label = spec.label;
  let note: string | undefined;

  if (!available.has(metric) && spec.countyFallback && county && countyMetrics.has(metric)) {
    sourceGeoid = county.geoid;
    label = `${spec.label} (${county.short_name ?? county.name})`;
    note = `Reported for ${county.name}, the county this place sits in.`;
  }

  const history = series(db, sourceGeoid, metric);
  const fact: Fact | null = history.length ? (history[history.length - 1] ?? null) : null;

  const usHistory = spec.compare ? series(db, "0100000US", metric) : [];
  const comparison = fact && history.length > 0 && usHistory.length >= history.length
    ? usHistory.slice(-history.length)
    : [];

  return {
    metric,
    label,
    fact,
    history,
    comparison,
    comparisonLabel: comparison.length ? "United States" : null,
    note,
  };
}

function contextFor(place: Place): { available: Set<string>; county: Place | null; countyMetrics: Set<string> } {
  const available = new Set(metricsFor(db, place.geoid));
  const county = place.kind === "place" ? countyForPlace(db, place) : null;
  const countyMetrics = county ? new Set(metricsFor(db, county.geoid)) : new Set<string>();
  return { available, county, countyMetrics };
}

function buildPanels(place: Place): Panel[] {
  const ctx = contextFor(place);
  return REPORT_ORDER.map((metric) => panelFor(place, metric, ctx.available, ctx.county, ctx.countyMetrics));
}

function send(res: ServerResponse, code: number, body: string, type = "text/html; charset=utf-8"): void {
  res.writeHead(code, { "content-type": type, "cache-control": "public, max-age=300" });
  res.end(body);
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { location });
  res.end();
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  try {
    if (path === "/healthz") {
      return send(res, 200, JSON.stringify({ ok: true, data: meta["data.version"] ?? null }), "application/json");
    }
    if (path === "/robots.txt") return send(res, 200, "User-agent: *\nAllow: /\n", "text/plain");
    if (path === "/") return send(res, 200, home());
    if (path === "/status") return send(res, 200, status(counts(db), meta));

    if (path === "/s") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q) return redirect(res, "/");
      const places = searchPlaces(db, q);
      if (places.length === 1 && places[0]) return redirect(res, `/p/${places[0].geoid}`);
      return send(res, 200, searchResults(q, places));
    }

    if (path === "/ask") {
      const question = (url.searchParams.get("q") ?? "").trim();
      if (!question) return redirect(res, "/");

      const parsed = parseQuestion(db, question);
      let place = parsed.place;
      let metric = parsed.metric;

      // The model is a fallback for the questions the local parse could not
      // place. It chooses from a menu and never sees a value.
      if ((!place || !metric) && process.env.OPENROUTER_API_KEY) {
        const menu = Object.entries(METRICS).map(([id, s]) => ({ id, label: s.label }));
        const choice = await askModel(db, question, menu);
        if (!place && choice?.geoid) place = getPlace(db, choice.geoid);
        if (!metric && choice?.metric && METRICS[choice.metric]) metric = choice.metric;
      }

      if (!place) {
        const candidates = searchPlaces(db, question);
        if (candidates.length > 1) return send(res, 200, searchResults(question, candidates));
        if (candidates.length === 1 && candidates[0]) return redirect(res, `/p/${candidates[0].geoid}`);
        const examples = ["Is rent going up in Austin", "Population of Cook County", "Federal money in Philadelphia"];
        return send(res, 404, askNeedPlace(question, metric ? (METRICS[metric]?.label ?? metric) : null, examples));
      }

      const ctx = contextFor(place);

      if (!metric) {
        if (parsed.via === "exact" && ctx.available.size > 1) {
          return send(res, 200, report(place, buildPanels(place), meta));
        }
        const offered = REPORT_ORDER
          .map((m) => panelFor(place, m, ctx.available, ctx.county, ctx.countyMetrics))
          .filter((p) => p.fact)
          .map((p) => ({ id: p.metric, label: METRICS[p.metric]?.label ?? p.label }));
        return send(res, 200, askNeedMetric(question, place, offered));
      }

      const panel = panelFor(place, metric, ctx.available, ctx.county, ctx.countyMetrics);
      if (!panel.fact) {
        const offered = REPORT_ORDER
          .filter((m) => ctx.available.has(m))
          .map((m) => ({ id: m, label: METRICS[m]?.label ?? m }));
        return send(res, 200, askNeedMetric(question, place, offered));
      }

      const followUps = REPORT_ORDER
        .filter((m) => m !== metric)
        .filter((m) => panelFor(place, m, ctx.available, ctx.county, ctx.countyMetrics).fact)
        .slice(0, 3)
        .map((m) => ({
          label: METRICS[m]?.label ?? m,
          href: `/ask?q=${encodeURIComponent(`${METRICS[m]?.label ?? m} in ${place?.name}`)}`,
        }));

      return send(res, 200, askCard(question, place, panel, followUps));
    }

    const match = path.match(/^\/p\/(\d{2,11})$/);
    if (match?.[1]) {
      const place = getPlace(db, match[1]);
      if (!place) {
        return send(res, 404, shell("Not found", `<h1 class="place">Not found</h1><p class="sub">No place with GEOID ${match[1]}.</p>`));
      }
      return send(res, 200, report(place, buildPanels(place), meta));
    }

    return send(res, 404, shell("Not found", `<h1 class="place">Not found</h1><p class="sub">That page does not exist. <a href="/">Start again</a>.</p>`));
  } catch (error) {
    console.error(error);
    return send(res, 500, shell("Error", `<h1 class="place">Something broke</h1><p class="sub">${(error as Error).message}</p>`));
  }
}

createServer((req, res) => { void handle(req, res); }).listen(PORT, HOST, () => {
  const c = counts(db);
  console.log(`EconPulse on http://${HOST}:${PORT}`);
  console.log(`${c.places.toLocaleString("en-US")} places · ${c.facts.toLocaleString("en-US")} facts · data ${meta["data.version"] ?? "?"}`);
  console.log(process.env.OPENROUTER_API_KEY ? "model fallback: enabled" : "model fallback: off (no OPENROUTER_API_KEY)");
});
