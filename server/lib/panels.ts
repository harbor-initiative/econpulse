/**
 * Turning a place and a measure into a panel.
 *
 * The county fallback is the only interesting part. A city does not publish its
 * own output or its own federal obligations, so those numbers come from the
 * county the city sits in, and the panel says so rather than pretending.
 */


import { series, metricsFor, countyForPlace, getPlace, directionOf, type Place, type Fact } from "../store.ts";
import { db } from "./runtime.ts";
import { METRICS, REPORT_ORDER, type MetricSpec } from "./metrics.ts";
import type { BenchRow, Panel, PanelMark, QuickFact } from "../views/panel.ts";
import { formatValue } from "../views/format.ts";

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

/**
 * Whether the gap against the nation is big enough to have a direction.
 *
 * A county at 4.32% unemployment against a nation at 4.30% is not doing worse
 * than the country; it is the country. A tenth of a point for a rate and half a
 * percent for a quantity are the smallest gaps this page will call a difference.
 */
function meaningfulGap(place: number, nation: number, unit: string): boolean {
  const gap = Math.abs(place - nation);
  if (unit === "percent" || unit === "years") return gap >= 0.1;
  if (nation === 0) return gap > 0;
  return gap / Math.abs(nation) >= 0.005;
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

  // A word, in ink. Colour would say up or down and be read as good or bad.
  let mark: PanelMark | null = null;
  const direction = directionOf(db, metric);
  if (fact && nationFact && place.geoid !== "0100000US" && direction !== "neutral" && meaningfulGap(fact.value, nationFact.value, fact.unit)) {
    const higher = fact.value > nationFact.value;
    const better = direction === "higher_is_better" ? higher : !higher;
    mark = better ? "better" : "worse";
  }

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
    mark,
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

/** The measures the report does not panel, and the two national series. */
const QUICK_METRICS = [
  "median_age",
  "bachelors_or_higher",
  "poverty_rate",
  "labor_force_participation_rate",
  "median_home_value",
  "median_household_income",
  "unemployment_rate_acs",
] as const;

const QUICK_NATIONAL = ["cpi", "mortgage_rate_30y"] as const;

function latest(geoid: string, metric: string): Fact | null {
  const rows = series(db, geoid, metric);
  return rows.length ? (rows[rows.length - 1] ?? null) : null;
}

/**
 * Nine facts from the file, and the one derived number: this place's share of
 * its state.
 *
 * The report panels cover five measures. Seven more are in the file and were
 * invisible, and two of those are the national series that make the local
 * numbers mean something.
 */
export function quickFacts(place: Place): QuickFact[] {
  const facts: QuickFact[] = [];

  for (const metric of QUICK_METRICS) {
    const fact = latest(place.geoid, metric);
    if (!fact) continue;
    facts.push({
      label: METRICS[metric]?.label ?? fact.label,
      value: formatValue(fact.value, fact.unit),
      agency: fact.agency,
      period: fact.period,
      scope: "place",
    });
  }

  for (const metric of QUICK_NATIONAL) {
    const fact = latest("0100000US", metric);
    if (!fact) continue;
    facts.push({
      label: `${METRICS[metric]?.label ?? fact.label} (United States)`,
      value: formatValue(fact.value, fact.unit),
      agency: fact.agency,
      period: fact.period,
      scope: "nation",
    });
  }

  const population = latest(place.geoid, "population");
  const state = stateFor(place);
  const statePopulation = state ? latest(state.geoid, "population") : null;
  if (population && statePopulation && statePopulation.value > 0) {
    const share = (population.value / statePopulation.value) * 100;
    facts.push({
      label: `Share of ${state?.short_name ?? "the state"}`,
      value: `${share.toFixed(2)}%`,
      agency: population.agency,
      period: population.period,
      scope: "share",
    });
  }

  return facts;
}

