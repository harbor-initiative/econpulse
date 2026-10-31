/**
 * The two states that ask a clarifying question instead of guessing.
 *
 * A box that cannot answer has to say which part it is missing. These are the
 * pages for “I need a place” and “I need a measure”.
 */


import type { Place } from "../store.ts";
import { esc, shell } from "./layout.ts";
export function askNeedPlace(question: string, metricLabel: string | null, examples: string[]): string {
  return shell(
    `Which place? — EconPulse`,
    `<p class="crumb">You asked</p>
     <h1 class="place" style="font-size:1.6rem">${esc(question)}</h1>
     <p class="sub">${metricLabel ? `I can answer that with ${esc(metricLabel.toLowerCase())}, but I need a place.` : "I need a place to answer that."}</p>
     <form class="search" action="/ask" method="get" style="margin-left:0">
       <input type="search" name="q" value="${esc(question)}" aria-label="Try again with a place">
     </form>
     <div class="chips" style="justify-content:flex-start">${examples
       .map((e) => `<a class="chip" href="/ask?q=${encodeURIComponent(e)}">${esc(e)}</a>`)
       .join("")}</div>`,
  );
}

export function askNeedMetric(question: string, place: Place, metrics: Array<{ id: string; label: string }>): string {
  return shell(
    `${place.name} — EconPulse`,
    `<p class="crumb">You asked</p>
     <h1 class="place" style="font-size:1.6rem">${esc(question)}</h1>
     <p class="sub">I found ${esc(place.name)}. Pick a measure, or open the full report.</p>
     <div class="chips" style="justify-content:flex-start;margin-top:1rem">
       ${metrics.map((m) => `<a class="chip" href="/ask?q=${encodeURIComponent(`${m.label} in ${place.name}`)}">${esc(m.label)}</a>`).join("")}
       <a class="chip" href="/p/${esc(place.geoid)}">Full report</a>
     </div>`,
  );
}
