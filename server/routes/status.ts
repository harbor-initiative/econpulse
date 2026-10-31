/**
 * `/status` and `/healthz`.
 *
 * `/status` is for a reader: what is inside the file. `/healthz` is for a
 * container: did the process start. #24 makes both answer about the data.
 */


import type { ServerResponse } from "node:http";
import { counts } from "../store.ts";
import { db, meta } from "../lib/runtime.ts";
import { send } from "../lib/http.ts";
import { status } from "../views/status.ts";

export async function routeStatus(url: URL, res: ServerResponse): Promise<boolean> {
  const path = url.pathname;

  if (path === "/healthz") {
    send(res, 200, JSON.stringify({ ok: true, data: meta["data.version"] ?? null }), "application/json");
    return true;
  }
  if (path === "/status") {
    send(res, 200, status(counts(db), meta));
    return true;
  }
  return false;
}
