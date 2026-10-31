/**
 * The list a search returns when the name was not exact.
 */


import type { Place } from "../store.ts";
import { esc, shell } from "./layout.ts";
export function searchResults(query: string, places: Place[]): string {
  if (!places.length) {
    return shell(
      `No match for ${query}`,
      `<p class="crumb">Search</p><h1 class="place hsub">We do not know that place.</h1>
       <p class="sub">Check the spelling, add a state, or try a ZIP code. Coverage is every county and every place above 1,000 people.</p>
       <form class="search" action="/s" method="get"><input type="search" name="q" value="${esc(query)}" aria-label="Place"></form>`,
    );
  }
  const items = places
    .map(
      (p) => `<li><a href="/p/${esc(p.geoid)}"><span class="rn">${esc(p.name)}${p.state_code ? `, ${esc(p.state_code)}` : ""}</span>
        <span class="rk">${esc(p.kind)}${p.population ? ` · ${p.population.toLocaleString("en-US")}` : ""}</span></a></li>`,
    )
    .join("");
  return shell(
    `${query} — EconPulse`,
    `<p class="crumb">Search</p><h1 style="font-size:1.5rem">${places.length > 1 ? `${places.length} places match` : "One place matches"}</h1>
     <ul class="results">${items}</ul>`,
    { canonical: "/s", description: `Places matching ${query}.`, robots: "noindex" },
  );
}
