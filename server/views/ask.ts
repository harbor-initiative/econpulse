/**
 * One question, one card, three follow-ups.
 */


import type { Fact, Place } from "../store.ts";
import { esc, shell } from "./layout.ts";
import { renderPanel, type Panel } from "./panel.ts";
import { compareBars, seriesReadout } from "./charts.ts";
import { formatValue } from "./format.ts";
export function askCard(
  question: string,
  place: Place,
  panel: Panel,
  followUps: Array<{ label: string; href: string }>,
  notice?: string,
): string {
  const body = renderPanel(panel);
  return shell(
    `${question} — EconPulse`,
    `<p class="crumb">You asked · ${esc(place.name)}${place.state_code ? `, ${esc(place.state_code)}` : ""}</p>
     ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
     <h1 class="place hsub" style="max-width:24ch">${esc(question)}</h1>
     <div class="grid" style="grid-template-columns:1fr;margin-top:1.2rem">${body}</div>
     <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:1.2rem">
       ${followUps.map((f) => `<a class="chip" href="${esc(f.href)}">${esc(f.label)}</a>`).join("")}
       <a class="chip" href="/p/${esc(place.geoid)}">Full report</a>
     </div>`,
    { canonical: `/p/${place.geoid}`, robots: "noindex" },
  );
}

/**
 * Two places, side by side.
 *
 * One block per measure they both publish, drawn as two series with both names
 * in the legend. The page says which place it dropped when a second name did not
 * resolve, because silently answering about one place is the failure this
 * feature exists to avoid.
 */
export function compareCard(
  question: string,
  a: Place,
  b: Place,
  rows: Array<{ label: string; a: Fact[]; b: Fact[]; metric: string; note?: string }>,
  dropped: string | null,
): string {
  const blocks = rows
    .map((row) => {
      const latestA = row.a[row.a.length - 1];
      const latestB = row.b[row.b.length - 1];
      const headline = `<p class="value" data-number>${esc(formatValue(latestA?.value ?? 0, latestA?.unit ?? ""))}<span class="vs">against ${esc(formatValue(latestB?.value ?? 0, latestB?.unit ?? ""))}</span></p>`;

      // A single period each is a pair of numbers, and a line through one point
      // is not a chart. Two bars say the same thing and can be read.
      if (row.a.length < 2 || row.b.length < 2) {
        const unit = latestA?.unit ?? "";
        return `<div class="metric full">
        <p class="label">${esc(row.label)}</p>
        ${row.note ? `<p class="bench-note">${esc(row.note)}</p>` : ""}
        ${headline}
        ${compareBars([
          { label: a.name, value: latestA?.value ?? 0 },
          { label: b.name, value: latestB?.value ?? 0 },
        ], unit)}
      </div>`;
      }

      const readout = seriesReadout(row.a, row.b, b.name, { placeLabel: a.name, deltaTarget: b.name });
      return `<div class="metric full">
        <p class="label">${esc(row.label)}</p>
        ${row.note ? `<p class="bench-note">${esc(row.note)}</p>` : ""}
        ${headline}
        ${readout.delta ? `<p class="delta">${readout.delta}</p>` : ""}
        ${readout.chart}${readout.legend}
      </div>`;
    })
    .join("");

  return shell(
    `${a.name} and ${b.name} — EconPulse`,
    `<p class="crumb">You asked · comparing two places</p>
     <h1 class="place hsub" style="max-width:32ch">${esc(question)}</h1>
     ${dropped ? `<p class="notice">${esc(dropped)}</p>` : ""}
     <div class="tools"><span class="tv">${esc(a.name)}</span><span class="tv">${esc(b.name)}</span></div>
     <div class="grid">${blocks}</div>`,
    { robots: "noindex", description: `${a.name} and ${b.name}, compared measure by measure.` },
  );
}

/** Two places with nothing in common, said plainly. */
export function compareEmpty(question: string, a: Place, b: Place): string {
  return shell(
    `${a.name} and ${b.name} — EconPulse`,
    `<p class="crumb">You asked</p>
     <h1 class="place hsub">${esc(question)}</h1>
     <p class="sub">${esc(a.name)} and ${esc(b.name)} have no measures in common in this file, so there is nothing to put side by side.</p>
     <div class="chips" style="justify-content:flex-start;margin-top:1rem">
       <a class="chip" href="/p/${esc(a.geoid)}">${esc(a.name)}</a>
       <a class="chip" href="/p/${esc(b.geoid)}">${esc(b.name)}</a>
     </div>`,
    { robots: "noindex" },
  );
}
