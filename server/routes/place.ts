/**
 * `/p/:geoid` — the full report for one place.
 *
 * The `?zip=` parameter is a courtesy: a ZIP resolves to a county, and the page
 * says so rather than letting a reader believe a postal route is a place.
 */


import type { ServerResponse } from "node:http";
import { getPlace } from "../store.ts";
import { db, meta } from "../lib/runtime.ts";
import { send } from "../lib/http.ts";
import { buildPanels, quickFacts } from "../lib/panels.ts";
import { factDateSpan } from "../lib/freshness.ts";
import { summarise } from "../lib/summary.ts";
import { shell } from "../views/layout.ts";
import { report } from "../views/report.ts";

export async function routePlace(url: URL, res: ServerResponse): Promise<boolean> {
  const match = url.pathname.match(/^\/p\/(\d{2,11})$/);
  if (!match?.[1]) return false;

  const place = getPlace(db, match[1]);
  if (!place) {
    send(res, 404, shell("Not found", `<h1 class="place">Not found</h1><p class="sub">No place with GEOID ${match[1]}.</p>`));
    return true;
  }

  const zip = url.searchParams.get("zip");
  const notice = zip && /^\d{5}$/.test(zip)
    ? `ZIP ${zip}. ZIP codes follow postal routes, so these figures are for ${place.name}.`
    : undefined;
  const panels = buildPanels(place);
  // One sentence per place per data version. The fallback is a template, so a
  // missing key or a busy model still puts a sentence under the score.
  const summary = await summarise(
    { placeName: place.name, panels: panels.map((panel) => ({ label: panel.label, fact: panel.fact, mark: panel.mark })) },
    meta["data.version"] ?? "?",
  );
  send(res, 200, report(place, panels, meta, notice, factDateSpan(db), quickFacts(place), summary.text));
  return true;
}
