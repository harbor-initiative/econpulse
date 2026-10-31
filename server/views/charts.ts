/**
 * Charts: a spec in, an SVG string out.
 *
 * Two series maximum, one baseline rule, no gridlines. The markup is ours so
 * the same numbers can be re-rendered somewhere that has no browser.
 */


import type { Fact } from "../store.ts";
import { formatValue } from "./format.ts";
import { esc } from "./layout.ts";
const TEAL = "#009689";

const BLUE = "#104E64";

const RULE = "#E4E2DC";

function points(values: number[], width: number, height: number): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 8)).toFixed(1)}`)
    .join(" ");
}

export function lineChart(values: number[], comparison: number[] = []): string {
  const w = 320;
  const h = 54;
  const base = `<line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}" stroke="${RULE}" stroke-width="1"/>`;
  const compare = comparison.length > 1
    ? `<polyline points="${points(comparison, w, h)}" fill="none" stroke="${BLUE}" stroke-width="1.2" stroke-dasharray="4 3"/>`
    : "";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${points(values, w, h)}" fill="none" stroke="${TEAL}" stroke-width="1.7" stroke-linejoin="round"/>
    ${compare}${base}</svg>`;
}

export function barChart(values: number[], labels: string[]): string {
  const w = 320;
  const h = 54;
  const max = Math.max(...values, 1);
  const slot = w / values.length;
  const barW = Math.max(6, slot * 0.62);
  const bars = values
    .map((v, i) => {
      const bh = Math.max(2, (v / max) * (h - 8));
      const x = i * slot + (slot - barW) / 2;
      return `<rect x="${x.toFixed(1)}" y="${(h - 1 - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${TEAL}"/>`;
    })
    .join("");
  const ticks = labels.length
    ? `<div class="years"><span>${esc(labels[0])}</span><span>${esc(labels[labels.length - 1])}</span></div>`
    : "";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${bars}
    <line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}" stroke="${RULE}" stroke-width="1"/></svg>${ticks}`;
}

/**
 * One proportion, drawn as a bar.
 *
 * The third of the three allowed visuals, and the one a single-period total
 * needs: a county's population has no series to plot and no honest axis to share
 * with a country, so the only meaningful visual is how much of its parent it is.
 */
export function shareBar(percent: number, label: string, placeValue: number, parentValue: number, unit: string): string {
  const width = Math.max(1.5, Math.min(100, percent));
  return `<div class="sharebar" data-visual>
    <span class="sbtrack"><i style="width:${width.toFixed(1)}%"></i></span>
    <span class="sblabel">${esc(percent.toFixed(2))}% of ${esc(label)} · ${esc(formatValue(placeValue, unit))} of ${esc(formatValue(parentValue, unit))}</span>
  </div>`;
}

/**
 * The chart, its legend, and the delta beside it, from one array pair.
 *
 * Three things describe one comparison, and the reason this is a single function
 * is that they can disagree in a way a reader will believe: a dashed line with a
 * delta that measures a different thing is a chart that lies while every part of
 * it is individually correct.
 */
export interface SeriesReadout {
  chart: string;
  legend: string;
  delta: string;
}

export function seriesReadout(
  history: Fact[],
  comparison: Fact[],
  comparisonLabel: string | null,
  options: { isCount?: boolean; placeLabel?: string; deltaTarget?: string } = {},
): SeriesReadout {
  const values = history.map((row) => row.value);
  const drawCompare = comparison.length === history.length && comparison.length > 0;
  const chart = options.isCount
    ? barChart(values, history.map((row) => row.period))
    : lineChart(values, drawCompare ? comparison.map((row) => row.value) : []) +
      `<div class="years"><span>${esc(history[0]?.period ?? "")}</span><span>${esc(history[history.length - 1]?.period ?? "")}</span></div>`;

  // The legend lists the series in draw order, because it is built from the same
  // two arrays the paths are built from.
  const legend = drawCompare && comparisonLabel
    ? `<p class="legend"><span><i class="sw sw-solid"></i>${esc(options.placeLabel ?? "This place")}</span><span><i class="sw sw-dash"></i>${esc(comparisonLabel)}</span></p>`
    : "";

  const latest = history[history.length - 1] ?? null;
  const previous = history[history.length - 2] ?? null;
  const against = drawCompare ? (comparison[comparison.length - 1] ?? null) : null;

  let delta = "";
  if (latest && against && comparisonLabel) {
    // The chart draws two lines, so the number beside it has to be about those
    // two lines. A change since last month, next to a national line, reads as a
    // gap against the nation.
    const gap = latest.value - against.value;
    // A gap in dollars is not a gap in points. Printing 8577461000.0 next to
    // "+$85.8B above" would be the same fact written two ways and only one of
    // them readable.
    const magnitude = latest.unit === "percent"
      ? `${Math.abs(gap).toFixed(1)} pts`
      : latest.unit === "years"
        ? `${Math.abs(gap).toFixed(1)} years`
        : formatValue(Math.abs(gap), latest.unit);
    const sign = gap >= 0 ? "+" : "−";
    const direction = gap >= 0 ? "above" : "below";
    delta = `${sign}${magnitude} ${direction} ${esc(options.deltaTarget ?? `the ${comparisonLabel}`)}`;
  } else if (latest && previous && previous.value !== 0) {
    const change = latest.value - previous.value;
    const sign = change >= 0 ? "+" : "−";
    const body = latest.unit === "percent"
      ? `${sign}${Math.abs(change).toFixed(1)} pts`
      : `${sign}${Math.abs((change / previous.value) * 100).toFixed(1)}%`;
    delta = `${body} vs ${esc(previous.period)}`;
  }

  return { chart, legend, delta };
}

export function compareBars(rows: Array<{ label: string; value: number }>, unit: string): string {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<div class="compare">${rows
    .map(
      (r) => `<div class="crow">
        <span class="cl">${esc(r.label)}</span>
        <span class="cbar"><i style="width:${Math.max(2, (r.value / max) * 100).toFixed(1)}%"></i></span>
        <span class="cv">${esc(formatValue(r.value, unit))}</span>
      </div>`,
    )
    .join("")}</div>`;
}
