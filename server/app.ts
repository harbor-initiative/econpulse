/**
 * The router, and the two pages nobody asks for.
 *
 * A route module answers `true` when it owned the path. The order below is
 * arbitrary because the paths are disjoint, so a new route appends a line rather
 * than finds a slot.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { counts } from "./store.ts";
import { db, meta } from "./lib/runtime.ts";
import { send } from "./lib/http.ts";
import { shell } from "./views/layout.ts";
import { routeAssets } from "./routes/assets.ts";
import { routeStatus } from "./routes/status.ts";
import { routeHome } from "./routes/home.ts";
import { routePlace } from "./routes/place.ts";
import { routeAsk } from "./routes/ask.ts";

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (await routeStatus(url, res)) return;
    if (await routeAssets(url, res)) return;
    if (await routeHome(url, res)) return;
    if (await routePlace(url, res)) return;
    if (await routeAsk(url, res, req)) return;

    send(res, 404, shell("Not found", `<h1 class="place">Not found</h1><p class="sub">That page does not exist. <a href="/">Start again</a>.</p>`));
  } catch (error) {
    console.error(error);
    send(res, 500, shell("Error", `<h1 class="place">Something broke</h1><p class="sub">${(error as Error).message}</p>`));
  }
}

export function start(): void {
  const PORT = Number(process.env.PORT ?? 3100);
  const HOST = process.env.HOST ?? "127.0.0.1";

  createServer((req, res) => { void handle(req, res); }).listen(PORT, HOST, () => {
    const c = counts(db);
    console.log(`EconPulse on http://${HOST}:${PORT}`);
    console.log(`${c.places.toLocaleString("en-US")} places · ${c.facts.toLocaleString("en-US")} facts · data ${meta["data.version"] ?? "?"}`);
    console.log(process.env.OPENROUTER_API_KEY ? "model fallback: enabled" : "model fallback: off (no OPENROUTER_API_KEY)");
  });
}
