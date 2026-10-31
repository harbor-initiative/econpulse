/**
 * Charts: a spec in, an SVG string out.
 *
 * Two series maximum, one baseline rule, no gridlines. The markup is ours so
 * the same numbers can be re-rendered somewhere that has no browser.
 */


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
