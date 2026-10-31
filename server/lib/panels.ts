/**
 * Turning a place and a measure into a panel.
 *
 * The county fallback is the only interesting part. A city does not publish its
 * own output or its own federal obligations, so those numbers come from the
 * county the city sits in, and the panel says so rather than pretending.
 */


import { series, metricsFor, countyForPlace, getPlace, type Place, type Fact } from "../store.ts";
import { db } from "./runtime.ts";
import { METRICS, REPORT_ORDER, type MetricSpec } from "./metrics.ts";
import type { BenchRow, Panel } from "../views/panel.ts";

/**
 * The state a place sits in, when that is a different place.
 *
 * A state page is its own benchmark, so it returns null rather than a duplicate
 * row. The nation is handled separately because `0100000US` is a place row too.
 */
function stateFor(place: Place): Place | null {
  if (place.kind === "us" || place.kind === "state") return null;
  const digits = place.geoid.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return getPlace(db, digits.slice(0, 2));
}

export function panelFor(
  place: Place,
  metric: string,
  available: Set<string>,
  county: Place | null,
  countyMetrics: Set<string>,
): Panel {
  const spec: MetricSpec = METRICS[metric] ?? { label: metric, compare: true, countyFallback: false };

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

  // The national series is fetched for every measure, because a benchmark is
  // useful even where the chart does not draw it. `spec.compare` only decides
  // whether the national line is drawn behind the place.
  const usHistory = series(db, "0100000US", metric);
  const comparison = fact && spec.compare && usHistory.length >= history.length
    ? usHistory.slice(-history.length)
    : [];
  const nationFact = usHistory.length ? (usHistory[usHistory.length - 1] ?? null) : null;

  const state = stateFor(place);
  const stateHistory = state ? series(db, state.geoid, metric) : [];
  const stateFact = stateHistory.length ? (stateHistory[stateHistory.length - 1] ?? null) : null;

  const benchmarks: BenchRow[] = [];
  if (fact) benchmarks.push({ label: "This place", value: fact.value, role: "place" });
  if (stateFact && state) {
    benchmarks.push({ label: state.short_name ?? state.name, value: stateFact.value, role: "state" });
  }
  if (nationFact && place.geoid !== "0100000US") {
    benchmarks.push({ label: "United States", value: nationFact.value, role: "nation" });
  }

  const missingBenchmarks: string[] = [];
  if (!stateFact && place.kind !== "us" && place.kind !== "state") missingBenchmarks.push("state series");
  if (!nationFact && place.geoid !== "0100000US") missingBenchmarks.push("national series");

  return {
    metric,
    label,
    fact,
    history,
    comparison,
    comparisonLabel: comparison.length ? "United States" : null,
    note,
    benchmarks,
    missingBenchmarks,
  };
}

export function contextFor(place: Place): { available: Set<string>; county: Place | null; countyMetrics: Set<string> } {
  const available = new Set(metricsFor(db, place.geoid));
  const county = place.kind === "place" ? countyForPlace(db, place) : null;
  const countyMetrics = county ? new Set(metricsFor(db, county.geoid)) : new Set<string>();
  return { available, county, countyMetrics };
}

export function buildPanels(place: Place): Panel[] {
  const ctx = contextFor(place);
  return REPORT_ORDER.map((metric) => panelFor(place, metric, ctx.available, ctx.county, ctx.countyMetrics));
}
