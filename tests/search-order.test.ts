/**
 * What a city name means.
 *
 * Typing "Austin" used to return Travis County, because the exact tier compared
 * full names and a city's name carries its type suffix. The metro alias then
 * answered a question the reader had not asked.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { openStore, searchPlaces } from "../server/store.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";
const db = skip ? null : openStore(DB);

test("a city name finds the city, not its county", { skip }, () => {
  const names = searchPlaces(db!, "Austin", 3).map((place) => place.name);
  assert.equal(names[0], "Austin city, Texas");
});

test("a compound name finds the place a reader means", { skip }, () => {
  const names = searchPlaces(db!, "Nashville", 3).map((place) => place.name);
  assert.match(names[0] ?? "", /Nashville-Davidson/);
});

test("a name shared by a city and a county offers both", { skip }, () => {
  const names = searchPlaces(db!, "Philadelphia", 3).map((place) => place.name);
  assert.ok(names.some((name) => name.includes("Philadelphia County")), names.join(" / "));
  assert.ok(names.some((name) => name.includes("Philadelphia city")), names.join(" / "));
});

test("an ambiguous name still returns a list", { skip }, () => {
  const results = searchPlaces(db!, "Springfield", 5);
  assert.ok(results.length > 1, "Springfield is several cities");
  for (const place of results) assert.equal(place.kind, "place");
});

test("a metro-only name still resolves through the alias", { skip }, () => {
  const results = searchPlaces(db!, "Bay Area", 1);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.name, "San Francisco County, California");
});

test("an exact full name is not displaced by a base-name match", { skip }, () => {
  const results = searchPlaces(db!, "Yonkers city", 3);
  assert.equal(results[0]?.name, "Yonkers city, New York");
});

test("a three-character query stays fast", { skip }, () => {
  const started = process.hrtime.bigint();
  const rounds = 20;
  for (let i = 0; i < rounds; i += 1) searchPlaces(db!, "aus", 8);
  const perQuery = Number(process.hrtime.bigint() - started) / 1e6 / rounds;
  assert.ok(perQuery < 5, `${perQuery.toFixed(2)} ms per query`);
});
