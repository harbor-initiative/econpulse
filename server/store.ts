import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { aliasGeoid, loadAliases } from "./lib/aliases.ts";
import { buildSearchIndex, isIndexBuilt, searchIndex } from "./lib/search-index.ts";

// Read the three alias CSVs once, before the first request. A malformed file
// fails the process at boot instead of returning an empty search.
loadAliases();

/**
 * Read-only access to the published file.
 *
 * The app never writes. It opens the database in read-only mode, which means a
 * borrowed file on a read-only mount still works, and a bug in a query cannot
 * corrupt someone's copy.
 */

export interface Place {
  geoid: string;
  kind: string;
  name: string;
  short_name: string | null;
  state_code: string | null;
  parent_geoid?: string | null;
  population: number | null;
}

export interface Fact {
  metric: string;
  period: string;
  value: number;
  unit: string;
  label: string;
  agency: string;
  dataset: string;
  table_id: string | null;
  vintage: string;
  retrieved_at: string;
  moe: number | null;
  revision: string | null;
  note: string | null;
}

export function openStore(path: string): DatabaseSync {
  if (!existsSync(path)) {
    throw new Error(
      [
        `No database at ${path}.`,
        "Set ECONPULSE_DB to the file, or put it at data/econpulse.db.",
        "Download the release artifact from the data release, or run `npm run load` with the four API keys.",
      ].join(" "),
    );
  }
  const db = new DatabaseSync(path, { readOnly: true });
  db.exec("PRAGMA query_only = ON;");
  return db;
}

/**
 * Where the file is.
 *
 * `ECONPULSE_DB` wins, so a container can mount a release at `/data` and swap it
 * without rebuilding the image. The default is the baked copy, which is what a
 * single-container reader gets.
 */
export function storePath(): string {
  return process.env.ECONPULSE_DB ?? resolve(import.meta.dirname, "..", "data", "econpulse.db");
}

export function getPlace(db: DatabaseSync, geoid: string): Place | null {
  const row = db
    .prepare("SELECT geoid, kind, name, short_name, state_code, parent_geoid, population FROM place WHERE geoid = ?")
    .get(geoid) as unknown as Place | undefined;
  return row ?? null;
}

/** Every row the search index holds, read once at boot. */
export function allPlaces(db: DatabaseSync): Place[] {
  return db
    .prepare("SELECT geoid, kind, name, short_name, state_code, parent_geoid, population FROM place")
    .all() as unknown as Place[];
}

export function searchPlaces(db: DatabaseSync, query: string, limit = 12): Place[] {
  const q = query.trim();
  if (!q) return [];

  // A GEOID or a ZIP is an exact lookup.
  if (/^\d{2,11}$/.test(q)) {
    const exact = db
      .prepare("SELECT geoid, kind, name, short_name, state_code, parent_geoid, population FROM place WHERE geoid = ?")
      .get(q) as unknown as Place | undefined;
    if (exact) return [exact];
  }

  // An exact name is an exact answer, and an alias never displaces it.
  const exact = db
    .prepare(
      `SELECT geoid, kind, name, short_name, state_code, parent_geoid, population
       FROM place
       WHERE name = ? COLLATE NOCASE OR short_name = ? COLLATE NOCASE
       ORDER BY
         CASE kind WHEN 'county' THEN 0 WHEN 'place' THEN 1 WHEN 'state' THEN 2 ELSE 3 END,
         population DESC
       LIMIT ?`,
    )
    .all(q, q, limit) as unknown as Place[];
  if (exact.length) return exact;

  // An alias is an exact answer too, so it beats a substring match.
  const aliased = aliasGeoid(q);
  if (aliased) {
    const place = getPlace(db, aliased);
    if (place) return limit > 0 ? [place] : [];
  }

  // Fuzzy last. The index is built once, then every search is a memory pass.
  if (!isIndexBuilt()) buildSearchIndex(allPlaces(db));
  return searchIndex(q, limit);
}

export function series(db: DatabaseSync, geoid: string, metric: string): Fact[] {
  return db
    .prepare(
      `SELECT f.metric, f.period, f.value, m.unit, m.label, f.agency, f.dataset, f.table_id,
              f.vintage, f.retrieved_at, f.moe, f.revision, f.note
       FROM fact f JOIN metric m ON m.id = f.metric
       WHERE f.geoid = ? AND f.metric = ?
       ORDER BY f.period`,
    )
    .all(geoid, metric) as unknown as Fact[];
}

export function latest(db: DatabaseSync, geoid: string, metric: string): Fact | null {
  const rows = series(db, geoid, metric);
  return rows.length ? (rows[rows.length - 1] ?? null) : null;
}

/**
 * Which way is better for a measure, as recorded in the file.
 *
 * `metric.direction` is `neutral`, `higher_is_better` or `lower_is_better`. It is
 * read from the database rather than restated in code so the editorial judgement
 * sits where a reviewer can see it and where a data change can correct it.
 */
const DIRECTIONS = new Map<string, string>();

export function directionOf(db: DatabaseSync, metric: string): string {
  const cached = DIRECTIONS.get(metric);
  if (cached) return cached;
  const row = db.prepare("SELECT direction FROM metric WHERE id = ?").get(metric) as { direction?: string } | undefined;
  const direction = row?.direction ?? "neutral";
  DIRECTIONS.set(metric, direction);
  return direction;
}

export function metricsFor(db: DatabaseSync, geoid: string): string[] {
  const rows = db
    .prepare("SELECT DISTINCT metric FROM fact WHERE geoid = ? ORDER BY metric")
    .all(geoid) as unknown as Array<{ metric: string }>;
  return rows.map((r) => r.metric);
}

/** The county a city sits in, matched by name. A heuristic, and labelled as one. */
export function countyForPlace(db: DatabaseSync, place: Place): Place | null {
  if (place.kind !== "place" || !place.state_code || !place.short_name) return null;
  const base = place.short_name.replace(/\s+(city|town|village|borough|township)$/i, "").trim();
  if (base.length < 3) return null;
  const row = db
    .prepare(
      `SELECT geoid, kind, name, short_name, state_code, parent_geoid, population FROM place
       WHERE kind = 'county' AND state_code = ? AND name LIKE ? COLLATE NOCASE
       ORDER BY population DESC LIMIT 1`,
    )
    .get(place.state_code, `%${base} County%`) as unknown as Place | undefined;
  return row ?? null;
}

/** A ZIP resolves to the county that holds most of its land. */
export function lookupZip(db: DatabaseSync, zip: string): Place | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const row = db.prepare("SELECT county_geoid FROM zcta WHERE zcta = ?").get(zip) as unknown as
    | { county_geoid: string }
    | undefined;
  return row ? getPlace(db, row.county_geoid) : null;
}

export function counts(db: DatabaseSync): { places: number; facts: number; metrics: number } {
  return db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM place) places,
              (SELECT COUNT(*) FROM fact)  facts,
              (SELECT COUNT(*) FROM metric) metrics`,
    )
    .get() as unknown as { places: number; facts: number; metrics: number };
}

export function buildMeta(db: DatabaseSync): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM build").all() as unknown as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
