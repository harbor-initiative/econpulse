/**
 * One panel: a label, a value, a visual, a receipt.
 *
 * The visual is mandatory. A panel that is a value and a receipt is the defect
 * the design audit named first, so the pieces that draw live beside it.
 */


import type { Fact } from "../store.ts";
import { esc } from "./layout.ts";
import { formatValue } from "./format.ts";
import { seriesReadout, compareBars, shareBar } from "./charts.ts";
import { ageInDays, bandOf } from "../lib/freshness.ts";
/**
 * Units where three values belong on one axis.
 *
 * A rate, an age and a monthly rent are the same kind of quantity at any scale,
 * so three bars compare honestly. A population and a gross domestic product are
 * totals, and putting a county on the same axis as a country is a chart that
 * cannot be read. Totals get shares instead.
 */
const COMPARABLE_UNITS = new Set(["percent", "years", "usd_per_month"]);

/** One row of the benchmark block: the place, its state, and the nation. */
export interface BenchRow {
  label: string;
  value: number;
  role: "place" | "state" | "nation";
}

export interface Panel {
  metric: string;
  label: string;
  fact: Fact | null;
  history: Fact[];
  comparison: Fact[];
  comparisonLabel: string | null;
  note?: string;
  benchmarks?: BenchRow[];
  missingBenchmarks?: string[];
}

function delta(latest: Fact, previous: Fact | null): string {
  if (!previous || previous.value === 0) return "";
  const change = latest.value - previous.value;
  const pct = (change / previous.value) * 100;
  const sign = change >= 0 ? "+" : "−";
  const unit = latest.unit === "percent" ? " pts" : "%";
  const body = latest.unit === "percent"
    ? `${sign}${Math.abs(change).toFixed(1)} pts`
    : `${sign}${Math.abs(pct).toFixed(1)}%`;
  void unit;
  return `${body} vs ${esc(previous.period)}`;
}

/** A total, described by how much of its parent it is. */
function shareLine(rows: BenchRow[], unit: string): string {
  const parts = rows
    .filter((row) => row.role !== "place")
    .map((row) => `${row.label} ${formatValue(row.value, unit)}`);
  const place = rows.find((row) => row.role === "place");
  const parent = rows.find((row) => row.role === "state") ?? rows.find((row) => row.role === "nation");
  if (place && parent && parent.value > 0) {
    const share = (place.value / parent.value) * 100;
    const shown = share < 0.01 ? share.toFixed(4) : share.toFixed(2);
    parts.push(`this place is ${shown}% of ${parent.role === "state" ? "the state" : "the nation"}`);
  }
  return parts.join(" · ");
}

/**
 * The series as a table, under the chart that draws it.
 *
 * The chart is `aria-hidden`, so this is the accessible path to the same
 * numbers. Collapsed by default: open, it is three times the height of the chart
 * above it, and a reader who wants the shape should not have to scroll past the
 * digits to reach the next panel.
 *
 * A value that is absent prints an em dash. A zero in a table of rates is a
 * reading, and this panel has no reading to give.
 */
function chartTable(panel: Panel): string {
  const { history, comparison, comparisonLabel, fact } = panel;
  if (!fact || history.length < 2) return "";

  const twoSeries = comparison.length === history.length && comparisonLabel;
  const head = twoSeries
    ? `<tr><th scope="col">Period</th><th scope="col">This place</th><th scope="col">${esc(comparisonLabel)}</th><th scope="col">Margin</th></tr>`
    : `<tr><th scope="col">Period</th><th scope="col">${esc(panel.label)}</th><th scope="col">Margin</th></tr>`;
  const dash = "—";

  const rows = history
    .map((row, index) => {
      const margin = row.moe === null ? dash : `±${Math.round(row.moe).toLocaleString("en-US")}`;
      const cells = twoSeries
        ? `<td>${esc(formatValue(row.value, row.unit))}</td><td>${esc(formatValue(comparison[index]?.value ?? 0, row.unit))}</td><td>${esc(margin)}</td>`
        : `<td>${esc(formatValue(row.value, row.unit))}</td><td>${esc(margin)}</td>`;
      return `<tr><th scope="row">${esc(row.period)}</th>${cells}</tr>`;
    })
    .join("");

  return `<details class="chart-table" data-chart-table>
      <summary>Table, ${history.length} periods</summary>
      <table><caption>${esc(panel.label)}${twoSeries ? `, against ${esc(comparisonLabel)}` : ""}</caption>
        <thead>${head}</thead><tbody>${rows}</tbody></table>
    </details>`;
}

export function renderPanel(panel: Panel): string {
  if (!panel.fact) {
    return `<div class="metric"><p class="label">${esc(panel.label)}</p>
      <p class="missing">No ${esc(panel.label.toLowerCase())} series for this place. ${esc(panel.note ?? "")}</p></div>`;
  }

  const { fact, history, comparison, comparisonLabel } = panel;
  const full = panel.metric === "federal_obligations" ? " full" : "";

  const readout = history.length > 1
    ? seriesReadout(history, comparison, comparisonLabel, { isCount: panel.metric === "federal_obligations" })
    : null;
  const chart = readout ? readout.chart + readout.legend : "";
  // A panel with one value used to draw a two-row comparison here. The
  // benchmark block below is that comparison, with the state added and with the
  // absent rows named, so drawing it twice would be two scales for one fact.

  // One source for the chart, the legend and the delta. `delta()` is the
  // fallback for a panel with a series but no comparison to draw.
  const prev = history.length > 1 ? (history[history.length - 2] ?? null) : null;
  const deltaText = readout ? readout.delta : prev ? delta(fact, prev) : "";

  // Staleness is a property of this panel's source, so it is announced here and
  // nowhere else. A page with one old series is not a stale page.
  const band = bandOf(fact.retrieved_at);
  const stale = band === "stale"
    ? `<p class="stale"><b>Stale</b> ${esc(fact.agency)} reported this figure on ${esc(fact.retrieved_at)}, ${ageInDays(fact.retrieved_at)} days ago.</p>`
    : "";

  const rows = panel.benchmarks ?? [];
  const absent = panel.missingBenchmarks ?? [];
  const comparable = COMPARABLE_UNITS.has(fact.unit);
  const parent = rows.find((row) => row.role === "state") ?? rows.find((row) => row.role === "nation") ?? null;
  const placeRow = rows.find((row) => row.role === "place") ?? null;
  const sharePercent = parent && placeRow && parent.value > 0 ? (placeRow.value / parent.value) * 100 : null;

  // One of three visuals, or the cell is a number and a receipt. The order is
  // the order the data supports: a series if there is one, three comparable
  // values if the units agree, and a proportion when the only fact is "how much
  // of its parent is this".
  const visual = chart
    ? chart
    : comparable && rows.length > 1
      ? compareBars(rows.map((row) => ({ label: row.label, value: row.value })), fact.unit)
      : sharePercent !== null && parent && placeRow
        ? shareBar(sharePercent, parent.label, placeRow.value, parent.value, fact.unit)
        : "";
  // Totals keep their parents' absolute values in words when a chart already
  // carries the shape, so the digits are never only in a tooltip that does not
  // exist.
  const share = chart && rows.length > 1 && !comparable ? shareLine(rows, fact.unit) : "";
  const benchNote = absent.length
    ? `<p class="bench-note">${absent.length > 1
        ? "This measure has no state or national series."
        : `This measure has no ${absent[0]}.`}</p>`
    : "";

  return `<div class="metric${full}" data-freshness="${band}">
    ${stale}
    <p class="label">${esc(panel.label)}</p>
    <p class="value">${esc(formatValue(fact.value, fact.unit))}</p>
    ${deltaText ? `<p class="delta">${deltaText}</p>` : ""}
    ${visual}
    ${chartTable(panel)}
    ${share ? `<p class="bench-share">${esc(share)}</p>` : ""}${benchNote}
    <p class="rec"><b>Receipt</b> ${esc(fact.agency)} · ${esc(fact.dataset)}${fact.table_id ? ` · ${esc(fact.table_id)}` : ""} · ${esc(fact.period)}${fact.moe !== null ? ` · ±${Math.round(fact.moe).toLocaleString("en-US")}` : ""} · pulled ${esc(fact.retrieved_at)}${band === "aging" ? ` · ${ageInDays(fact.retrieved_at)} days old` : ""}</p>
  </div>`;
}
