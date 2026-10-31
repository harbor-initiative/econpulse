/**
 * `/api/suggest` — the type-ahead.
 *
 * One request per keystroke, debounced by the client at 120 ms. The ranking is
 * `searchPlaces`: exact name, then alias, then the in-memory index (#6). The
 * fuzzy pass never touches the database and does not grow with the corpus; the
 * only SQL is the exact-name point lookup inside `store.ts`.
 *
 * The client is `public/combobox.js`, served by `routes/assets.ts` like every
 * other script in that directory.
 */

import type { ServerResponse } from "node:http";
import { searchPlaces, type Place } from "../store.ts";
import { db } from "../lib/runtime.ts";
import { send } from "../lib/http.ts";

/**
 * Eight rows, one screen. The spec bounds the list at ten; the lane brief asked
 * for eight, and a shorter list is inside that bound.
 */
export const SUGGEST_LIMIT = 8;

/** The longest query a keystroke can ask about. The rest is dropped, not read. */
export const MAX_QUERY = 80;

/** One character matches half the country. Two is the first useful prefix. */
export const MIN_QUERY = 2;

/** The row the combobox draws. Every field has a job: name alone is ambiguous. */
export interface Suggestion {
  geoid: string;
  name: string;
  kind: string;
  stateCode: string | null;
  population: number | null;
}

function toSuggestion(place: Place): Suggestion {
  return {
    geoid: place.geoid,
    name: place.name,
    kind: place.kind,
    stateCode: place.state_code,
    population: place.population,
  };
}

/**
 * Ranked rows for a query, or none.
 *
 * Split from the route so the ranking, the length cap and the limit are testable
 * without a response object.
 */
export function suggestionsFor(query: string): Suggestion[] {
  const q = query.slice(0, MAX_QUERY).trim();
  if (q.length < MIN_QUERY) return [];
  return searchPlaces(db, q, SUGGEST_LIMIT).map(toSuggestion);
}

export async function routeSuggest(url: URL, res: ServerResponse): Promise<boolean> {
  if (url.pathname !== "/api/suggest") return false;

  const suggestions = suggestionsFor(url.searchParams.get("q") ?? "");
  send(res, 200, JSON.stringify({ suggestions }), "application/json; charset=utf-8");
  return true;
}
