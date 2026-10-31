/**
 * `/method` — the page that answers "why should I trust this".
 */

import type { ServerResponse } from "node:http";
import { counts } from "../store.ts";
import { appVersion, db, meta } from "../lib/runtime.ts";
import { agencySummary } from "../lib/method.ts";
import { send } from "../lib/http.ts";
import { method } from "../views/method.ts";

export async function routeMethod(url: URL, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== "/method") return false;

  const totals = counts(db);
  send(res, 200, method({
    appVersion,
    dataVersion: meta["data.version"] ?? "?",
    built: (meta["build.finished_at"] ?? "").slice(0, 10),
    places: totals.places,
    facts: totals.facts,
    agencies: agencySummary(db),
  }));
  return true;
}
