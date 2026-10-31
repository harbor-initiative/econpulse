/**
 * What is inside the file, printed from the file.
 */


import { esc, shell } from "./layout.ts";
export function status(counts: { places: number; facts: number; metrics: number }, meta: Record<string, string>): string {
  const rows = Object.entries(meta)
    .map(([k, v]) => `<li><span class="mono">${esc(k)}</span> ${esc(v)}</li>`)
    .join("");
  return shell(
    "Status — EconPulse",
    `<p class="crumb">Status</p><h1 style="font-size:1.6rem">What is in the file</h1>
     <p class="sub">${counts.places.toLocaleString("en-US")} places · ${counts.facts.toLocaleString("en-US")} facts · ${counts.metrics} metrics</p>
     <ul class="results">${rows}</ul>`,
  );
}
