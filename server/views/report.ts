/**
 * The full report for one place.
 *
 * Five panels in a fixed order, a header that says where it comes from, and
 * nothing else. The order is a decision, not a layout accident.
 */


import type { Place } from "../store.ts";
import { esc, shell } from "./layout.ts";
import { appVersion } from "../lib/runtime.ts";
import { renderPanel, type Panel } from "./panel.ts";
import type { DateSpan } from "../lib/freshness.ts";
export function report(place: Place, panels: Panel[], meta: Record<string, string>, notice?: string, span?: DateSpan): string {
  const cards = panels.map((panel) => renderPanel(panel)).join("");
  const pulled = span?.oldest && span.newest
    ? (span.oldest === span.newest ? `pulled ${span.oldest}` : `pulled ${span.oldest} to ${span.newest}`)
    : null;
  const placeSub = [
    place.state_code,
    place.population ? `population ${place.population.toLocaleString("en-US")}` : null,
    `GEOID ${place.geoid}`,
  ].filter(Boolean).join(" · ");

  return shell(
    `${place.name} — EconPulse`,
    `<p class="crumb">${esc(place.kind)}</p>
     ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
     <h1 class="place">${esc(place.name)}</h1>
     <p class="sub">${esc(placeSub)}</p>
     <div class="tools"><span class="tv">data ${esc(meta["data.version"] ?? "?")} · built ${esc((meta["build.finished_at"] ?? "").slice(0, 10))}</span>
       ${pulled ? `<span class="tv">${esc(pulled)}</span>` : ""}
       <span class="tv">${esc(meta["build.source_count"] ?? String((meta["build.sources"] ?? "").split(/[·,]/).map((x) => x.trim()).filter(Boolean).length || "?"))} agencies</span></div>
     <div class="grid">${cards}</div>`,
    // Print is the only export, and a printed page loses every affordance the
    // screen has. The footer is the line that survives on paper, so it carries
    // where this came from and which file it is.
    `data ${meta["data.version"] ?? "?"} · app ${appVersion} · econpulse.harborgovcon.com · Numbers are illustrative of the source.`,
  );
}
