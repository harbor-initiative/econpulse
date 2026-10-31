#!/usr/bin/env node
/**
 * How old is the file, and is that old enough to say something.
 *
 * The workflow that calls this only needs the answer and the build record; the
 * decision about opening an issue lives in the workflow, where a reader can see
 * it next to the trigger.
 *
 *   node scripts/data-age.mjs            human lines
 *   node scripts/data-age.mjs --json     one object, for a workflow
 *
 * Exit code is always 0 when the file can be read. Staleness is data, not an
 * error: a job that fails its own run because the data is old reports a broken
 * job instead of an old file.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { openStore, storePath, buildMeta } from "../server/store.ts";
import { FRESHNESS, ageInDays, bandOf } from "../server/lib/freshness.ts";

const file = storePath();
if (!existsSync(file)) {
  console.error(`No database at ${file}.`);
  process.exit(2);
}

const db = openStore(file);
const meta = buildMeta(db);
const finishedAt = (meta["build.finished_at"] ?? "").slice(0, 10);
const retrieved = (meta["data.version"] ?? "") || null;
const age = finishedAt ? ageInDays(finishedAt) : null;

/**
 * Two thresholds, and they answer different questions.
 *
 * 45 days is when this job speaks up: long enough that a normal refresh cycle
 * never trips it. 120 days is when a page warns a reader, from
 * `lib/freshness.ts`. A monitor should be noisier than the page, because the
 * person reading the file can still fix it.
 */
const ALERT_AFTER_DAYS = Number(process.env.DATA_AGE_ALERT_DAYS ?? 45);

const result = {
  path: path.resolve(file),
  built_at: finishedAt || null,
  data_version: retrieved,
  age_days: age,
  band: age === null ? "unknown" : bandOf(finishedAt),
  threshold_days: ALERT_AFTER_DAYS,
  page_threshold_days: FRESHNESS.staleAfterDays,
  stale: age !== null && age > ALERT_AFTER_DAYS,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result));
  process.exit(0);
}

console.log(`file         ${result.path}`);
console.log(`data version ${result.data_version ?? "?"}`);
console.log(`built        ${result.built_at ?? "?"}`);
console.log(`age          ${age === null ? "unknown" : `${age} days`} (alert after ${ALERT_AFTER_DAYS}, page warns after ${FRESHNESS.staleAfterDays})`);
console.log(`band         ${result.band}`);
