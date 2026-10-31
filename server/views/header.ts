/**
 * The header block: where the number is, what it is made of, and where it came
 * from, in that order.
 *
 * The score is the largest thing on the page. The place name is second. Nothing
 * else competes, which is why the name drops from 35px to 28px and the build
 * strip becomes one line of mono under a rule.
 *
 * The weights are printed rather than hidden behind a tooltip or a link. A
 * composite number whose parts are invisible is a number a reader either trusts
 * or ignores, and there is no third option.
 */

import { esc } from "./layout.ts";
import type { Fact, Place } from "../store.ts";
import type { Score } from "../lib/score.ts";
import { weightsText } from "../lib/score.ts";
import type { DateSpan } from "../lib/freshness.ts";

export interface HeaderInput {
  place: Place;
  score: Score | null;
  /** The newest and oldest retrieval dates in the file. */
  span?: DateSpan;
  /** The first panel's fact, promoted so one receipt sits above the fold. */
  promoted?: Fact | null;
  dataVersion: string;
  built: string;
  /** The sentence under the score. #12 fills it. */
  summary?: string | null;
}

/** "62 among counties · 55 among places" */
function peers(score: Score): string {
  return score.readings
    .map((reading) => `${reading.pct.toFixed(0)} among ${reading.peerKind === "county" ? "counties" : "places"}`)
    .join(" · ");
}

export function reportHeader(input: HeaderInput): string {
  const { place, score, span, promoted, dataVersion, built, summary } = input;

  const scope = [
    place.state_code,
    place.population ? `population ${place.population.toLocaleString("en-US")}` : null,
    `GEOID ${place.geoid}`,
  ].filter(Boolean).join(" · ");

  const pulled = span?.oldest && span.newest
    ? (span.oldest === span.newest ? `pulled ${span.oldest}` : `pulled ${span.oldest} to ${span.newest}`)
    : null;

  const scoreBlock = score
    ? `<div class="hscore">
        <span class="score">${score.value}</span>
        <span class="hlabel">${esc(score.label)}</span>
        <span class="hpeers">${esc(peers(score))}</span>
        <span class="hweights">${esc(weightsText())} · <a href="/method">method</a></span>
       </div>`
    : `<p class="hpending">No score yet. It is computed when the file is built.</p>`;

  const receipt = promoted
    ? `<p class="hreceipt"><b>${esc(promoted.agency)}</b> · ${esc(promoted.dataset)}${promoted.table_id ? ` · ${esc(promoted.table_id)}` : ""} · ${esc(promoted.period)}${promoted.moe !== null ? ` · ±${Math.round(promoted.moe).toLocaleString("en-US")}` : ""} · pulled ${esc(promoted.retrieved_at)}</p>`
    : "";

  return `<header class="hblock">
    <p class="crumb">${esc(place.kind)}</p>
    <h1 class="place">${esc(place.name)}</h1>
    <p class="scope">${esc(scope)}</p>
    <div class="hrule"></div>
    ${scoreBlock}
    ${summary ? `<p class="hsummary">${esc(summary)}</p>` : ""}
    <div class="hrule light"></div>
    ${receipt}
    <p class="htv">data ${esc(dataVersion)} · built ${esc(built)}${pulled ? ` · ${esc(pulled)}` : ""}</p>
  </header>`;
}
