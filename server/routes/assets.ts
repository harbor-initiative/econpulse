/**
 * The two files a crawler asks for, and nothing else.
 *
 * A favicon is not served, and that is deliberate: a request for one is 404 like
 * any other path a reader types.
 */


import type { ServerResponse } from "node:http";
import { send } from "../lib/http.ts";

export async function routeAssets(url: URL, res: ServerResponse): Promise<boolean> {
  if (url.pathname === "/robots.txt") {
    send(res, 200, "User-agent: *\nAllow: /\n", "text/plain");
    return true;
  }
  return false;
}
