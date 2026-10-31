/**
 * `/api/where?lat=&lon=` — which place is at this point.
 *
 * The browser knows where it is and posts a coordinate. The answer is a geoid,
 * so the client can send the reader to a page that already exists rather than
 * rendering a second kind of page for one button.
 */

import type { ServerResponse } from "node:http";
import { placeAt } from "../lib/where.ts";
import { send } from "../lib/http.ts";

export async function routeWhere(url: URL, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== "/api/where") return false;

  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    send(res, 400, JSON.stringify({ error: "lat and lon are required numbers" }), "application/json");
    return true;
  }

  const found = placeAt(lon, lat);
  if (!found) {
    // A point outside every boundary is not an error in the request.
    send(res, 404, JSON.stringify({ error: "no place at that point", lat, lon }), "application/json");
    return true;
  }

  send(res, 200, JSON.stringify({ geoid: found.geoid, kind: found.kind, href: `/p/${found.geoid}` }), "application/json");
  return true;
}
