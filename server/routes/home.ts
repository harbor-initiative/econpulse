/**
 * `/` and `/s` — the front door and the search list.
 *
 * A single exact match redirects to the report, because a one-item list is a
 * click that answers nothing.
 */


import type { ServerResponse } from "node:http";
import { searchPlaces } from "../store.ts";
import { db } from "../lib/runtime.ts";
import { redirect, send } from "../lib/http.ts";
import { home } from "../views/home.ts";
import { searchResults } from "../views/search.ts";

export async function routeHome(url: URL, res: ServerResponse): Promise<boolean> {
  const path = url.pathname;

  if (path === "/") {
    send(res, 200, home());
    return true;
  }
  if (path !== "/s") return false;

  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) {
    redirect(res, "/");
    return true;
  }
  const places = searchPlaces(db, q);
  if (places.length === 1 && places[0]) {
    redirect(res, `/p/${places[0].geoid}`);
    return true;
  }
  send(res, 200, searchResults(q, places));
  return true;
}
