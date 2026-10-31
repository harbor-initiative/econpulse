#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  openStore, storePath, getPlace, searchPlaces, series, metricsFor,
  countyForPlace, counts, buildMeta, type Place,
} from "./store.ts";
import { home, searchResults, report, status, shell, type Panel } from "./view.ts";

/**
 * The web server.
 *
 * Two routes that matter: a search box and a place report. Everything else is
 * infrastructure. No framework, no bundler, no client-side router, so a
 * self-hoster can read the whole thing in a sitting.
 */

const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? "127.0.0.1";

const db = openStore(storePath());
const meta = buildMeta(db);

const PANELS: Array<{ metric: string; label: string; countyFallback: boolean; compare: boolean }> = [
  { metric: "population", label: "Population", countyFallback: false, compare: false },
  { metric: "unemployment_rate", label: "Unemployment", countyFallback: true, compare: true },
  { metric: "median_gross_rent", label: "Median gross rent", countyFallback: false, compare: true },
  { metric: "gdp", label: "Output", countyFallback: true, compare: false },
  { metric: "federal_obligations", label: "Federal obligations", countyFallback: true, compare: false },
];

function buildPanels(place: Place): Panel[] {
  const available = new Set(metricsFor(db, place.geoid));
  const county = place.kind === "place" ? countyForPlace(db, place) : null;
  const countyMetrics = county ? new Set(metricsFor(db, county.geoid)) : new Set<string>();

  return PANELS.map((spec) => {
    let sourceGeoid = place.geoid;
    let label = spec.label;
    let note: string | undefined;

    if (!available.has(spec.metric) && spec.countyFallback && county && countyMetrics.has(spec.metric)) {
      sourceGeoid = county.geoid;
      label = `${spec.label} (${county.short_name ?? county.name})`;
      note = `Reported for ${county.name}, the county this place sits in.`;
    }

    const history = series(db, sourceGeoid, spec.metric);
    const fact = history.length ? (history[history.length - 1] ?? null) : null;

    // The national series, only when it lines up period for period.
    const usHistory = spec.compare ? series(db, "0100000US", spec.metric) : [];
    const comparison = fact && usHistory.length >= history.length && history.length > 0
      ? usHistory.slice(-history.length)
      : [];

    return {
      metric: spec.metric,
      label,
      fact,
      history,
      comparison,
      comparisonLabel: comparison.length ? "United States" : null,
      note,
    };
  });
}

function send(res: ServerResponse, status: number, body: string, type = "text/html; charset=utf-8"): void {
  res.writeHead(status, { "content-type": type, "cache-control": "public, max-age=300" });
  res.end(body);
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  try {
    if (path === "/healthz") {
      return send(res, 200, JSON.stringify({ ok: true, data: meta["data.version"] ?? null }), "application/json");
    }

    if (path === "/robots.txt") {
      return send(res, 200, "User-agent: *\nAllow: /\n", "text/plain");
    }

    if (path === "/") {
      return send(res, 200, home());
    }

    if (path === "/status") {
      return send(res, 200, status(counts(db), meta));
    }

    if (path === "/s") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q) return send(res, 302, "", "text/plain");
      const places = searchPlaces(db, q);
      if (places.length === 1 && places[0]) {
        res.writeHead(302, { location: `/p/${places[0].geoid}` });
        res.end();
        return;
      }
      return send(res, 200, searchResults(q, places));
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

createServer(handle).listen(PORT, HOST, () => {
  const c = counts(db);
  console.log(`EconPulse on http://${HOST}:${PORT}`);
  console.log(`${c.places.toLocaleString("en-US")} places · ${c.facts.toLocaleString("en-US")} facts · data ${meta["data.version"] ?? "?"}`);
});
