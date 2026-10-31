/**
 * One question, one card, three follow-ups.
 */


import type { Place } from "../store.ts";
import { esc, shell } from "./layout.ts";
import { renderPanel, type Panel } from "./panel.ts";
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
     <h1 class="place" style="font-size:1.6rem;max-width:24ch">${esc(question)}</h1>
     <div class="grid" style="grid-template-columns:1fr;margin-top:1.2rem">${body}</div>
     <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:1.2rem">
       ${followUps.map((f) => `<a class="chip" href="${esc(f.href)}">${esc(f.label)}</a>`).join("")}
       <a class="chip" href="/p/${esc(place.geoid)}">Full report</a>
     </div>`,
    { canonical: `/p/${place.geoid}`, robots: "noindex" },
  );
}
