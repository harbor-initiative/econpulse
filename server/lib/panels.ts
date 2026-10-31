/**
 * Turning a place and a measure into a panel.
 *
 * The county fallback is the only interesting part. A city does not publish its
 * own output or its own federal obligations, so those numbers come from the
 * county the city sits in, and the panel says so rather than pretending.
 */


import { series, metricsFor, countyForPlace, type Place, type Fact } from "../store.ts";
import { db } from "./runtime.ts";
import { METRICS, REPORT_ORDER, type MetricSpec } from "./metrics.ts";
import type { Panel } from "../views/panel.ts";

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
