/**
 * Where a place sits among its peers, computed once at build.
 *
 * The old score was invented arithmetic nobody could check. A percentile is
 * auditable: it says "this value is higher than 62% of the counties in the
 * file", and anyone can recompute it from the same file.
 *
 * Two peer sets, because one number cannot answer both questions a reader asks.
 * A city is a place among places and also sits inside a county, and those are
 * different comparisons with different peer counts.
 *
 * The direction comes from `metric.direction`, so "better" is a property of the
 * measure and not of this file.
 */

import type { DatabaseSync } from "node:sqlite";

export type PeerKind = "county" | "place";

/** A metric needs this many peers before its percentile means anything. */
export const MIN_PEERS = 100;

export interface PercentileRow {
  geoid: string;
  metric: string;
  peerKind: PeerKind;
  /** 0–100, already flipped for `lower_is_better`. */
  pct: number;
  peers: number;
}

interface Sample {
  geoid: string;
  value: number;
}

/**
 * The percentile of one value inside a sorted list, with ties counted at the
 * middle of the run they share.
 *
 * Ties matter here: four counties reporting the same rounded rent should not
 * receive four different percentiles because of their order in the file.
 */
export function percentileOf(values: number[], value: number): number {
  if (!values.length) return 0;
  let below = 0;
  let equal = 0;
  for (const candidate of values) {
    if (candidate < value) below += 1;
    else if (candidate === value) equal += 1;
  }
  const rank = below + (equal - 1) / 2;
  return values.length === 1 ? 50 : (rank / (values.length - 1)) * 100;
}

/** Newest value per geoid for one metric, within one kind. */
function samplesFor(db: DatabaseSync, metric: string, kind: string): Sample[] {
  const rows = db
    .prepare(
      `SELECT f.geoid AS geoid, f.value AS value
       FROM fact f
       JOIN place p ON p.geoid = f.geoid
       WHERE f.metric = ? AND p.kind = ?
         AND f.rowid = (
           SELECT f2.rowid FROM fact f2
           WHERE f2.geoid = f.geoid AND f2.metric = f.metric
           ORDER BY f2.period DESC LIMIT 1
         )`,
    )
    .all(metric, kind) as unknown as Sample[];
  return rows.filter((row) => Number.isFinite(row.value));
}

function directions(db: DatabaseSync): Map<string, string> {
  const rows = db.prepare("SELECT id, direction FROM metric").all() as unknown as Array<{ id: string; direction: string }>;
  return new Map(rows.map((row) => [row.id, row.direction]));
}

function countyOfPlace(db: DatabaseSync, geoid: string): string | null {
  const row = db.prepare("SELECT parent_geoid FROM place WHERE geoid = ?").get(geoid) as
    | { parent_geoid: string | null }
    | undefined;
  return row?.parent_geoid ?? null;
}

/**
 * Every percentile in both peer sets.
 *
 * A county gets a county reading. A city gets a place reading and, through its
 * county, a county reading — because "worse than the country" and "worse than
 * comparable cities" are different sentences and the page shows both.
 */
export function computePercentiles(db: DatabaseSync): PercentileRow[] {
  const direction = directions(db);
  const metrics = (db.prepare("SELECT id FROM metric ORDER BY id").all() as unknown as Array<{ id: string }>).map(
    (row) => row.id,
  );

  const out: PercentileRow[] = [];
  const countyValues = new Map<string, Map<string, number>>();
  const placeValues = new Map<string, Map<string, number>>();
  const countyPeers = new Map<string, number>();

  for (const metric of metrics) {
    if (direction.get(metric) === "neutral") continue;

    for (const [kind, into] of [
      ["county", countyValues],
      ["place", placeValues],
    ] as Array<[string, Map<string, Map<string, number>>]>) {
      const samples = samplesFor(db, metric, kind);
      if (samples.length < MIN_PEERS) continue;
      const values = samples.map((sample) => sample.value).sort((a, b) => a - b);
      const flip = direction.get(metric) === "lower_is_better";
      if (kind === "county") countyPeers.set(metric, values.length);

      for (const sample of samples) {
        const raw = percentileOf(values, sample.value);
        const pct = Math.round((flip ? 100 - raw : raw) * 10) / 10;
        out.push({ geoid: sample.geoid, metric, peerKind: kind as PeerKind, pct, peers: values.length });
        const bucket = into.get(sample.geoid) ?? new Map<string, number>();
        bucket.set(metric, pct);
        into.set(sample.geoid, bucket);
      }
    }
  }

  // A city's county reading: the county's percentile, carried onto the city so
  // the page can show both without a second lookup. The peer count is the
  // county's, because that is the set the reading came from.
  for (const [geoid, byMetric] of placeValues) {
    const county = countyOfPlace(db, geoid);
    if (!county) continue;
    const countyRows = countyValues.get(county);
    if (!countyRows) continue;
    for (const [metric, pct] of countyRows) {
      out.push({ geoid, metric, peerKind: "county", pct, peers: countyPeers.get(metric) ?? 0 });
    }
  }

  return out;
}

/** Write the table, replacing whatever is there. */
export function loadPercentiles(db: DatabaseSync): PercentileRow[] {
  const rows = computePercentiles(db);
  db.exec("DELETE FROM percentile");
  const insert = db.prepare(
    "INSERT OR REPLACE INTO percentile (geoid, metric, peer_kind, pct, peers) VALUES (?, ?, ?, ?, ?)",
  );
  for (const row of rows) insert.run(row.geoid, row.metric, row.peerKind, row.pct, row.peers);
  return rows;
}
