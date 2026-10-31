/**
 * The ranked search index: one pass over `place` at boot, answered from memory.
 *
 * Exact names and aliases are answered in `store.ts` (#5). This is the fuzzy
 * layer that replaced the `LIKE` scan: prefix, trigram similarity, substring.
 * Trigrams are three characters padded with a space, hashed into one flat
 * sorted array, and compared with the Dice coefficient.
 */

import { normalizeTerm } from "./aliases.ts";
import type { Place } from "../store.ts";

/** The place-type words the spec drops from a name. "County" stays. */
const PLACE_TYPE = /\s+(city|town|village|borough|cdp)$/;
const TRIGRAM_FLOOR = 0.6;

/** Old SQL order, for a deterministic final tie-break. */
const KIND_RANK: Record<string, number> = { county: 0, place: 1, state: 2, us: 3 };

export interface IndexEntry {
  geoid: string; name: string; norm: string; kind: string;
  stateCode: string | null; population: number | null;
}

interface IndexedEntry extends IndexEntry {
  shortName: string | null;
  parentGeoid: string | null;
  gramStart: number;
  gramLength: number;
}

export interface IndexStats {
  places: number; trigrams: number; buildMs: number; bytes: number;
}

let entries: IndexedEntry[] = [];
/** Base name -> entries, for the exact tier. Built with the index, read on every keystroke. */
let byBase = new Map<string, IndexedEntry[]>();
/** First word -> entries, so `Nashville` finds `Nashville-Davidson` without a scan. */
let byToken = new Map<string, IndexedEntry[]>();
let grams = new Int32Array(0);
let stats: IndexStats | null = null;

/** Lowercase, strip punctuation, and drop the place-type suffix. */
export function normalizeName(value: string): string {
  return normalizeTerm(value).replace(PLACE_TYPE, "").trim();
}

/** Replace the set with the unique trigram hashes of a normalized name. */
function fillHashes(set: Set<number>, value: string): void {
  set.clear();
  const padded = ` ${value} `;
  for (let i = 0; i + 3 <= padded.length; i += 1) {
    let h = 2166136261;
    h = Math.imul(h ^ padded.charCodeAt(i), 16777619);
    h = Math.imul(h ^ padded.charCodeAt(i + 1), 16777619);
    h = Math.imul(h ^ padded.charCodeAt(i + 2), 16777619);
    set.add(h | 0);
  }
}

/** A query's unique trigram hashes, sorted ascending. */
function queryGrams(value: string): Int32Array {
  const set = new Set<number>();
  fillHashes(set, value);
  return Int32Array.from([...set].sort((a, b) => a - b));
}

/** Dice coefficient over two sorted hash arrays. */
function dice(a: Int32Array, b: Int32Array, bStart: number, bLength: number): number {
  if (a.length === 0 || bLength === 0) return 0;
  let i = 0, j = bStart;
  const end = bStart + bLength;
  let shared = 0;
  while (i < a.length && j < end) {
    const left = a[i] as number;
    const right = b[j] as number;
    if (left === right) {
      shared += 1;
      i += 1;
      j += 1;
    } else if (left < right) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return (2 * shared) / (a.length + bLength);
}

/** Counted from the retained strings and arrays: heap readings swing by 15 MB. */
function footprint(all: IndexedEntry[], flat: Int32Array): number {
  let bytes = flat.byteLength + all.length * 8;
  for (const entry of all) {
    bytes += 96;
    const strings = [entry.geoid, entry.name, entry.norm, entry.kind, entry.shortName, entry.stateCode, entry.parentGeoid];
    for (const value of strings) bytes += value ? 16 + value.length * 2 : 8;
  }
  return bytes;
}

/** Build once at boot, or on the first search in a process that imports store. */
export function buildSearchIndex(places: Place[]): IndexStats {
  const started = performance.now();
  const next: IndexedEntry[] = [];
  const scratch = new Set<number>();
  let total = 0;

  for (const place of places) {
    const norm = normalizeName(place.short_name ?? place.name);
    fillHashes(scratch, norm);
    next.push({
      geoid: place.geoid, name: place.name, norm, kind: place.kind,
      stateCode: place.state_code, population: place.population,
      shortName: place.short_name, parentGeoid: place.parent_geoid ?? null,
      gramStart: total, gramLength: scratch.size,
    });
    total += scratch.size;
  }

  const flat = new Int32Array(total);
  for (const entry of next) {
    fillHashes(scratch, entry.norm);
    let at = entry.gramStart;
    for (const hash of scratch) flat[at++] = hash;
    flat.subarray(entry.gramStart, entry.gramStart + entry.gramLength).sort();
  }

  entries = next;
  grams = flat;
  byBase = new Map();
  byToken = new Map();
  for (const entry of next) {
    const bucket = byBase.get(entry.norm);
    if (bucket) bucket.push(entry);
    else byBase.set(entry.norm, [entry]);

    const token = entry.norm.split(/[\s-]+/)[0] ?? entry.norm;
    const first = byToken.get(token);
    if (first) first.push(entry);
    else byToken.set(token, [entry]);
  }
  stats = {
    places: entries.length,
    trigrams: total,
    buildMs: performance.now() - started,
    bytes: footprint(next, flat),
  };

  console.error(
    `search index: ${stats.places.toLocaleString("en-US")} places · ` +
      `${stats.trigrams.toLocaleString("en-US")} trigrams · ` +
      `${stats.buildMs.toFixed(1)} ms · ${(stats.bytes / 1048576).toFixed(2)} MB footprint`,
  );
  return stats;
}

/**
 * The exact tier: the name a reader typed, with or without its type suffix.
 *
 * A city's name is `Austin city`. A reader types `Austin`. A county is `Austin
 * County`. `Nashville-Davidson` answers to `Nashville`. All four are the same
 * question, so they are answered from one map instead of a scan of 19,000 rows
 * on every keystroke.
 */
export function exactMatches(query: string, limit = 12): Place[] {
  const q = normalizeName(query);
  if (!q || limit <= 0) return [];

  const found = new Map<string, IndexedEntry>();
  for (const entry of byBase.get(q) ?? []) found.set(entry.geoid, entry);
  // `Nashville-Davidson` shares its first word with the query, and the token map
  // is a lookup rather than a scan of every place. Normalisation turns the
  // hyphen into a space, so the test is for either separator.
  for (const entry of byToken.get(q) ?? []) {
    if (entry.norm.startsWith(`${q} `) || entry.norm.startsWith(`${q}-`)) found.set(entry.geoid, entry);
  }

  return [...found.values()]
    .sort((a, b) => {
      const population = (b.population ?? -1) - (a.population ?? -1);
      if (population !== 0) return population;
      return (KIND_RANK[a.kind] ?? 4) - (KIND_RANK[b.kind] ?? 4);
    })
    .slice(0, limit)
    .map((entry) => ({
      geoid: entry.geoid, kind: entry.kind, name: entry.name,
      short_name: entry.shortName, state_code: entry.stateCode,
      parent_geoid: entry.parentGeoid, population: entry.population,
    }));
}

export function isIndexBuilt(): boolean {
  return stats !== null;
}

export function indexStats(): IndexStats | null {
  return stats;
}

/**
 * Rank candidates. Exact names and aliases never reach here: `store.ts` answers
 * them first, which is the order #5 established.
 *
 * Every trigram candidate over the floor is admitted, then ordered by
 * population. That is the spec's stated editorial choice ("Springfield" means
 * the one most people mean), and it keeps a typo of "Philadelphia" on the county
 * the correctly spelled query already returns.
 */
export function searchIndex(query: string, limit = 12): Place[] {
  const q = normalizeName(query);
  if (!q || limit <= 0) return [];

  const qGrams = q.length >= 3 ? queryGrams(q) : new Int32Array(0);
  const matches: Array<{ entry: IndexedEntry; tier: number }> = [];

  for (const entry of entries) {
    let tier = -1;

    if (entry.norm.startsWith(q)) {
      tier = 0; // prefix
    } else {
      if (qGrams.length > 0) {
        const smallest = Math.min(qGrams.length, entry.gramLength);
        const ceiling = (2 * smallest) / (qGrams.length + entry.gramLength);
        if (ceiling >= TRIGRAM_FLOOR && dice(qGrams, grams, entry.gramStart, entry.gramLength) >= TRIGRAM_FLOOR) {
          tier = 1; // trigram
        }
      }
      if (tier === -1 && entry.norm.includes(q)) tier = 2; // substring
    }

    if (tier !== -1) matches.push({ entry, tier });
  }

  matches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const population = (b.entry.population ?? -1) - (a.entry.population ?? -1);
    if (population !== 0) return population;
    const kind = (KIND_RANK[a.entry.kind] ?? 4) - (KIND_RANK[b.entry.kind] ?? 4);
    if (kind !== 0) return kind;
    return a.entry.geoid.localeCompare(b.entry.geoid);
  });

  return matches.slice(0, limit).map(({ entry }) => ({
    geoid: entry.geoid, kind: entry.kind, name: entry.name,
    short_name: entry.shortName, state_code: entry.stateCode,
    parent_geoid: entry.parentGeoid, population: entry.population,
  }));
}
