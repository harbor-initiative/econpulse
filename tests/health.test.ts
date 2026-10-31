/**
 * The two answers about the data: the JSON a monitor drains, and the page a
 * person reads.
 *
 * The stale path is proved by moving the clock, not by editing the file. Every
 * fact in the released file was retrieved on 2026-10-31, so the file is fresh
 * today and becomes stale on its own terms 121 days later.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildMeta, counts, openStore, storePath } from "../server/store.ts";
import { FRESHNESS, ageWords, fileFacts } from "../server/lib/freshness.ts";
import { healthAnswer, healthReport } from "../server/routes/status.ts";
import { status } from "../server/views/status.ts";

const db = openStore(storePath());
const facts = fileFacts(db);
const meta = buildMeta(db);

const FRESH = new Date("2026-10-31T12:00:00Z");
const AGING = new Date("2026-12-15T12:00:00Z");
const STALE = new Date("2027-03-01T12:00:00Z");

test("the health body carries every field, and every value comes from the file", () => {
  const direct = db
    .prepare("SELECT MIN(retrieved_at) AS oldest, MAX(retrieved_at) AS newest, COUNT(*) AS facts FROM fact")
    .get() as unknown as { oldest: string; newest: string; facts: number };

  const { code, body } = healthReport(facts, meta, FRESH);
  assert.equal(code, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data, meta["data.version"]);
  assert.equal(body.built_at, meta["build.finished_at"]);
  assert.equal(body.facts, direct.facts);
  assert.equal(body.facts, counts(db).facts);
  assert.equal(body.oldest, direct.oldest);
  assert.equal(body.newest, direct.newest);
  assert.equal(body.oldest_retrieval, direct.oldest);
  assert.equal(body.ageDays, 0);
  assert.equal(body.band, "fresh");
  assert.equal(body.agingAfterDays, FRESHNESS.agingAfterDays);
  assert.equal(body.staleAfterDays, FRESHNESS.staleAfterDays);
  assert.deepEqual(body.stale_sources, []);
  assert.equal(body.newest_fact, "2026-10-29");
});

test("newest_fact is the newest period by date, not the largest string", () => {
  // A plain MAX(period) returns FY2026, which sorts above every calendar date.
  assert.notEqual(facts.newestPeriod, "FY2026");
  assert.equal(facts.newestPeriod, "2026-10-29");
  assert.equal(facts.agencies.length, 5);
  assert.equal(facts.agencies.reduce((sum, agency) => sum + agency.facts, 0), facts.facts);
});

test("a fresh or aging file answers 200; a stale file answers 503 with the same body", () => {
  const fresh = healthReport(facts, meta, FRESH);
  const aging = healthReport(facts, meta, AGING);
  const stale = healthReport(facts, meta, STALE);

  assert.equal(fresh.code, 200);
  assert.equal(fresh.body.band, "fresh");
  assert.equal(aging.code, 200);
  assert.equal(aging.body.band, "aging");
  assert.equal(stale.code, 503);
  assert.equal(stale.body.ok, false);
  assert.equal(stale.body.band, "stale");
  assert.ok((stale.body.ageDays ?? 0) > FRESHNESS.staleAfterDays);
  assert.deepEqual(Object.keys(stale.body).sort(), Object.keys(fresh.body).sort(), "the 503 carries the 200's fields");
  assert.equal(stale.body.data, fresh.body.data);
  assert.equal(stale.body.newest, fresh.body.newest);
});

test("stale_sources names the agencies the status page marks stale", () => {
  const stale = healthReport(facts, meta, STALE);
  const page = status(counts(db), meta, facts, STALE);

  assert.equal(stale.body.stale_sources.length, facts.agencies.length);
  for (const agency of stale.body.stale_sources) {
    assert.ok(page.includes(`data-agency="${agency}" data-band="stale"`), `${agency} carries the stale badge`);
  }

  const freshPage = status(counts(db), meta, facts, FRESH);
  assert.ok(!freshPage.includes('data-band="stale"'), "today no source is stale");
});

test("the status page lists every agency with its facts, its dates and its age", () => {
  const page = status(counts(db), meta, facts, FRESH);
  for (const agency of facts.agencies) {
    assert.ok(page.includes(agency.agency), `${agency.agency} is listed`);
    assert.ok(page.includes(`${agency.facts.toLocaleString("en-US")} facts`), `${agency.facts} facts for ${agency.agency}`);
    assert.ok(page.includes(agency.oldestRetrieval), `retrieval date for ${agency.agency}`);
  }
  assert.ok(page.includes(`${counts(db).facts.toLocaleString("en-US")} facts`), "the file total is on the page");
  assert.ok(page.includes(meta["data.version"] ?? "no data version"), "the data version is on the page");
  assert.ok(page.includes("pulled"), "the page names the retrieval range");
  assert.ok(page.includes("today"), "the newest age is in plain words");
});

test("a failed read answers 503 with the reason, not a 500 page", () => {
  const answer = healthAnswer(() => {
    throw new Error("no such table: fact");
  }, meta, FRESH);
  assert.equal(answer.code, 503);
  assert.equal(answer.body.ok, false);
  assert.match((answer.body as { error: string }).error, /no such table: fact/);
});

test("an age is said out loud", () => {
  assert.equal(ageWords(0), "today");
  assert.equal(ageWords(1), "yesterday");
  assert.equal(ageWords(121), "121 days ago");
});
