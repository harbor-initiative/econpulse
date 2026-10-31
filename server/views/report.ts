/**
 * The full report for one place.
 *
 * Five panels in a fixed order, a header that says where it comes from, and
 * nothing else. The order is a decision, not a layout accident.
 */


import type { Place } from "../store.ts";
import { esc, shell } from "./layout.ts";
import { reportHeader } from "./header.ts";
import { scoreFor } from "../lib/score.ts";
import { db } from "../lib/runtime.ts";
import { appVersion } from "../lib/runtime.ts";
import { placeJsonLd } from "../lib/structured.ts";
import { SITE } from "../lib/site.ts";
import { quickFactsGrid, renderPanel, type Panel, type QuickFact } from "./panel.ts";
import { formatValue } from "./format.ts";
import type { DateSpan } from "../lib/freshness.ts";
/** Meta description from the place and its headline numbers. */
function descriptionFor(place: Place, panels: Panel[]): string {
  const parts = panels
    .filter((panel) => panel.fact)
    .slice(0, 3)
    .map((panel) => `${panel.label.toLowerCase()} ${formatValue(panel.fact!.value, panel.fact!.unit)}`);
  return `${place.name}: ${parts.join(", ")}. Each figure carries its agency, dataset and retrieval date.`;
}

export function report(place: Place, panels: Panel[], meta: Record<string, string>, notice?: string, span?: DateSpan, quick?: QuickFact[]): string {
  const cards = panels.map((panel) => renderPanel(panel)).join("");
  const score = scoreFor(db, place);
  const promoted = panels.find((panel) => panel.fact)?.fact ?? null;

  return shell(
    `${place.name} — EconPulse`,
    `${reportHeader({
       place,
       score,
       span,
       promoted,
       dataVersion: meta["data.version"] ?? "?",
       built: (meta["build.finished_at"] ?? "").slice(0, 10),
     })}
     ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
     <div class="grid">${cards}</div>
     ${quickFactsGrid(quick ?? [])}`,
    {
      // Print is the only export, and a printed page loses every affordance the
      // screen has. The footer is the line that survives on paper, so it carries
      // where this came from and which file it is.
      footerNote: `data ${meta["data.version"] ?? "?"} · app ${appVersion} · econpulse.harborgovcon.com · Numbers are illustrative of the source.`,
      canonical: `/p/${place.geoid}`,
      description: descriptionFor(place, panels),
      jsonld: placeJsonLd(place, panels, meta),
    },
  );
}
