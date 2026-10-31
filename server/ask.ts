/**
 * The question layer.
 *
 * Two inputs, two paths.
 *
 *   "Philadelphia"            -> the index. No model, no network.
 *   "Is rent up in Austin?"   -> the model, then the index again.
 *
 * The split is deliberate. A question is not a place with the question words
 * removed. When the model cannot answer, the box asks which place instead of
 * guessing.
 */

import type { DatabaseSync } from "node:sqlite";
import { searchPlaces, type Place } from "./store.ts";
import { findMetric, splitMetricAndPlace } from "./lib/rules.ts";
import { askModel, type ModelOutcome } from "./lib/model.ts";

/**
 * The question layer.
 *
 * Two inputs, two paths.
 *
 *   "Philadelphia"            -> the index. No model, no network.
 *   "Is rent up in Austin?"   -> the model, then the index again.
 *
 * The split is deliberate. A previous version ran a keyword parser over
 * everything and answered "the Liberty Bell" with Bell County, Texas, because
 * "Bell" was the last word left after the stopwords came out. A question is not
 * a place with the question words removed.
 *
 * The model never receives a GEOID and never returns one. It names the place and
 * picks a measure; the index resolves the name. That makes a hallucinated id
 * impossible, which is the only failure here that would put a wrong number on a
 * page.
 */

export interface Parsed {
  place: Place | null;
  metric: string | null;
  via: "index" | "model" | "none";
  cleaned: string;
  /** What the model did, when it was asked. Undefined on the local path. */
  model?: ModelOutcome;
}

export function resolveName(db: DatabaseSync, name: string): Place | null {
  const candidate = name.trim();
  if (!candidate || candidate.length < 3) return null;
  const places = searchPlaces(db, candidate, 8);
  if (!places.length) return null;
  const lower = candidate.toLowerCase();
  const exact = places.find((p) => (p.short_name ?? p.name).toLowerCase() === lower);
  if (exact) return exact;
  const starts = places.find((p) => (p.short_name ?? p.name).toLowerCase().startsWith(lower));
  return starts ?? places[0] ?? null;
}

/** The no-model path: a name, or "measure in name". */
export function parseLocally(db: DatabaseSync, text: string): Parsed {
  const trimmed = text.trim();

  if (/^\d{2,11}$/.test(trimmed)) {
    const place = searchPlaces(db, trimmed, 1)[0] ?? null;
    return { place, metric: null, via: place ? "index" : "none", cleaned: trimmed };
  }

  const { metric, rest } = splitMetricAndPlace(trimmed);
  const place = resolveName(db, rest || trimmed);
  return { place, metric, via: place ? "index" : "none", cleaned: rest || trimmed };
}

/** Question path: model first, then the index resolves the name it returned. */
export async function parseQuestion(
  db: DatabaseSync,
  text: string,
  metrics: Array<{ id: string; label: string }>,
  dataVersion: string,
): Promise<Parsed> {
  const outcome = await askModel(text, metrics, { dataVersion });
  const answer = outcome.answer;
  if (answer) {
    const place = answer.placeName ? resolveName(db, answer.placeName) : null;
    const metric = answer.metric && metrics.some((m) => m.id === answer.metric) ? answer.metric : null;
    if (place || metric) {
      return { place, metric, via: place ? "model" : "none", cleaned: answer.placeName ?? text, model: outcome };
    }
  }

  // No key, or the model failed. Do not fall back to the word parser here: it
  // answered "the Liberty Bell" with Bell County, Texas. Asking which place is
  // honest; guessing is not. The outcome travels so the route can tell a busy
  // network from a question it did not read.
  return { place: null, metric: findMetric(text), via: "none", cleaned: text, model: outcome };
}
