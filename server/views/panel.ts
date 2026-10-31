/**
 * One panel: a label, a value, a visual, a receipt.
 *
 * The visual is mandatory. A panel that is a value and a receipt is the defect
 * the design audit named first, so the pieces that draw live beside it.
 */


import type { Fact } from "../store.ts";
import { esc } from "./layout.ts";
import { formatValue } from "./format.ts";
import { lineChart, barChart, compareBars } from "./charts.ts";
export interface Panel {
  metric: string;
  label: string;
  fact: Fact | null;
  history: Fact[];
  comparison: Fact[];
  comparisonLabel: string | null;
  note?: string;
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

export function renderPanel(panel: Panel): string {
  if (!panel.fact) {
    return `<div class="metric"><p class="label">${esc(panel.label)}</p>
      <p class="missing">No ${esc(panel.label.toLowerCase())} series for this place. ${esc(panel.note ?? "")}</p></div>`;
  }

  const { fact, history, comparison, comparisonLabel } = panel;
  const full = panel.metric === "federal_obligations" ? " full" : "";

  let chart = "";
  if (history.length > 1) {
    const values = history.map((h) => h.value);
    const compareValues = comparison.length === history.length ? comparison.map((c) => c.value) : [];
    const isCount = panel.metric === "federal_obligations";
    chart = isCount
      ? barChart(values, history.map((h) => h.period))
      : lineChart(values, compareValues) +
        `<div class="years"><span>${esc(history[0]?.period ?? "")}</span><span>${esc(history[history.length - 1]?.period ?? "")}</span></div>`;
  } else if (comparison.length && comparisonLabel) {
    chart = compareBars(
      [
        { label: "This place", value: fact.value },
        { label: comparisonLabel, value: comparison[0]?.value ?? 0 },
      ].filter((r) => r.value > 0),
      fact.unit,
    );
  }

  const prev = history.length > 1 ? (history[history.length - 2] ?? null) : null;
  const deltaText = prev ? delta(fact, prev) : "";

  return `<div class="metric${full}">
    <p class="label">${esc(panel.label)}</p>
    <p class="value">${esc(formatValue(fact.value, fact.unit))}</p>
    ${deltaText ? `<p class="delta">${deltaText}</p>` : ""}
    ${chart}
    <p class="rec"><b>Receipt</b> ${esc(fact.agency)} · ${esc(fact.dataset)}${fact.table_id ? ` · ${esc(fact.table_id)}` : ""} · ${esc(fact.period)}${fact.moe !== null ? ` · ±${Math.round(fact.moe).toLocaleString("en-US")}` : ""} · pulled ${esc(fact.retrieved_at)}</p>
  </div>`;
}
