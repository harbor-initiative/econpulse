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

/** A comparison has to be asked for; a model that volunteers one is ignored. */
export const COMPARISON_TRIGGER = /\b(vs\.?|versus|compared? (?:to|with)|compare)\b/i;

export function wantsComparison(text: string): boolean {
  return COMPARISON_TRIGGER.test(text);
}

export interface Parsed {
  place: Place | null;
  comparePlace?: Place | null;
  /** A second name the question asked about that the file does not carry. */
  dropped?: string;
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

/**
 * The no-model comparison: "Austin vs Nashville".
 *
 * The most obvious comparison shape does not need a model to read it, and going
 * to the index first means the feature works with no key, no network and no
 * quota. The model still handles "how does Austin compare with Nashville on
 * rent", which the grammar does not attempt.
 */
export function parseComparison(db: DatabaseSync, text: string): Parsed | null {
  const match = text.match(/^(.{2,}?)\s+(?:vs\.?|versus)\s+(.{2,})$/i);
  if (!match?.[1] || !match[2]) return null;
  const leftName = match[1].trim();
  const rightName = match[2].trim();
  const left = resolveName(db, leftName);
  const right = resolveName(db, rightName);

  if (left && right) {
    return { place: left, comparePlace: right, metric: null, via: "index", cleaned: text };
  }
  // One of the two is in the file. Answering about it and naming the one that is
  // not is better than refusing the whole question: the reader still gets the
  // half that exists.
  if (left) return { place: left, comparePlace: null, dropped: rightName, metric: null, via: "index", cleaned: text };
  if (right) return { place: right, comparePlace: null, dropped: leftName, metric: null, via: "index", cleaned: text };
  return null;
}

/** The no-model path: a name, or "measure in name". */
export function parseLocally(db: DatabaseSync, text: string): Parsed {
  const trimmed = text.trim();

  const comparison = wantsComparison(trimmed) ? parseComparison(db, trimmed) : null;
  if (comparison) return comparison;

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
      // The second name is only trusted when the question asked for a
      // comparison. A model that volunteers one for "Austin" would turn a
      // single-place question into a two-place page nobody asked for.
      const comparePlace = wantsComparison(text) && answer.compareTo ? resolveName(db, answer.compareTo) : null;
      return { place, metric, comparePlace, via: place ? "model" : "none", cleaned: answer.placeName ?? text, model: outcome };
    }
  }

  // No key, or the model failed. Do not fall back to the word parser here: it
  // answered "the Liberty Bell" with Bell County, Texas. Asking which place is
  // honest; guessing is not. The outcome travels so the route can tell a busy
  // network from a question it did not read.
  return { place: null, metric: findMetric(text), via: "none", cleaned: text, model: outcome };
}
