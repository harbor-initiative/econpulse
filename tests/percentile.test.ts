/**
 * A percentile anyone can recompute.
 *
 * The old score was invented arithmetic. The replacement is a rank, so the test
 * recomputes it independently from the same file and compares — that is the
 * whole argument for the number existing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { openStore } from "../server/store.ts";
import { MIN_PEERS, percentileOf } from "../pipeline/percentile.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const missing = !existsSync(DB);
const db = missing ? null : openStore(DB);

/** The table arrives with the first build that runs the percentile pass. */
const hasTable =
  !missing &&
  Boolean(
    (db!
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'percentile'")
      .get() as { name?: string } | undefined)?.name,
  );
const skip = missing ? "data/econpulse.db is not present" : !hasTable ? "the shipped file predates the percentile table" : false;

test("the percentile of the middle value is the middle", () => {
  assert.equal(percentileOf([1, 2, 3], 2), 50);
  assert.equal(percentileOf([1, 2, 3, 4, 5], 3), 50);
});

test("the extremes are the ends", () => {
  assert.equal(percentileOf([1, 2, 3, 4, 5], 1), 0);
  assert.equal(percentileOf([1, 2, 3, 4, 5], 5), 100);
});

test("ties share the middle of their run", () => {
  // Three values the same, one below, one above: the tie is at the centre.
  const values = [1, 2, 2, 2, 3];
  assert.equal(percentileOf(values, 2), 50);
});

test("the stored reading matches an independent recomputation", { skip }, () => {
  const rows = db!
    .prepare("SELECT geoid, metric, peer_kind, pct, peers FROM percentile ORDER BY geoid, metric, peer_kind")
    .all() as unknown as Array<{ geoid: string; metric: string; peer_kind: string; pct: number; peers: number }>;

  const sample = rows.find((row) => row.metric === "median_gross_rent") ?? rows[0]!;
  const peers = db!
    .prepare(
      `SELECT f.value AS value
       FROM fact f JOIN place p ON p.geoid = f.geoid
       WHERE f.metric = ? AND p.kind = ?
         AND f.rowid = (SELECT f2.rowid FROM fact f2 WHERE f2.geoid = f.geoid AND f2.metric = f.metric ORDER BY f2.period DESC LIMIT 1)`,
    )
    .all(sample.metric, sample.peer_kind) as unknown as Array<{ value: number }>;

  const values = peers.map((row) => row.value).sort((a, b) => a - b);
  const direction = db!.prepare("SELECT direction FROM metric WHERE id = ?").get(sample.metric) as { direction: string };
  const value = (db!
    .prepare(
      `SELECT f.value AS value FROM fact f WHERE f.geoid = ? AND f.metric = ?
       ORDER BY f.period DESC LIMIT 1`,
    )
    .get(sample.geoid, sample.metric) as { value: number }).value;
  const raw = percentileOf(values, value);
  const expected = Math.round((direction.direction === "lower_is_better" ? 100 - raw : raw) * 10) / 10;

  assert.equal(sample.pct, expected);
  assert.equal(sample.peers, values.length);
});

test("a peer set below the floor is not scored", { skip }, () => {
  const rows = db!
    .prepare("SELECT peers FROM percentile")
    .all() as unknown as Array<{ peers: number }>;
  for (const row of rows) {
    assert.ok(row.peers >= MIN_PEERS, `${row.peers} peers`);
  }
});
