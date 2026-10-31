/**
 * The ranked search index, tested two ways.
 *
 * A fixture proves the order, because "the best candidate is first" is the whole
 * feature and a fixture is the only place the expected order is knowable. The
 * open database proves the three typos a reader actually types, plus the two
 * numbers the spec pins: under 5 ms warm, under 150 ms to build.
 */

import test, { before, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { allPlaces, openStore, searchPlaces, type Place } from "../server/store.ts";
import { buildSearchIndex, indexStats, normalizeName, searchIndex } from "../server/lib/search-index.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";
const db = skip ? null : openStore(DB);

function first(query: string): Place | null {
  return searchPlaces(db!, query, 5)[0] ?? null;
}

function fixture(
  geoid: string,
  kind: string,
  name: string,
  shortName: string,
  stateCode: string,
  population: number,
  parent: string | null = null,
): Place {
  return { geoid, kind, name, short_name: shortName, state_code: stateCode, parent_geoid: parent, population };
}

describe("the open database", { skip }, () => {
  before(() => {
    buildSearchIndex(allPlaces(db!));
  });

  test("Philadelpia resolves to Philadelphia County", () => {
    assert.equal(first("Philadelpia")?.geoid, "42101");
    assert.equal(first("Philadelpia")?.name, "Philadelphia County, Pennsylvania");
  });

  test("Pittsburg resolves to Pittsburgh", () => {
    assert.equal(first("Pittsburg")?.geoid, "4261000");
    assert.equal(first("Pittsburg")?.name, "Pittsburgh city, Pennsylvania");
  });

  test("Pitsburgh, the narrower typo, also resolves to Pittsburgh", () => {
    assert.equal(first("Pitsburgh")?.geoid, "4261000");
  });

  test("Cincinatti resolves to Cincinnati", () => {
    assert.equal(first("Cincinatti")?.geoid, "3915000");
    assert.equal(first("Cincinatti")?.name, "Cincinnati city, Ohio");
  });

  test("an alias still beats a fuzzy hit", () => {
    const places = searchPlaces(db!, "Philly", 5);
    assert.equal(places.length, 1);
    assert.equal(places[0]?.geoid, "42101");
  });

  test("an exact name still beats an alias", () => {
    assert.equal(first("District of Columbia")?.geoid, "11001");
  });

  test("a three-character query answers in under 5 ms warm", () => {
    for (let i = 0; i < 10; i += 1) searchPlaces(db!, "phi");
    const started = performance.now();
    for (let i = 0; i < 200; i += 1) searchPlaces(db!, "phi");
    const mean = (performance.now() - started) / 200;
    assert.ok(mean < 5, `${mean.toFixed(2)} ms per query, budget 5 ms`);
  });

  test("the index covers every place, in under 150 ms, under 8 MB", () => {
    const count = db!.prepare("SELECT COUNT(*) AS c FROM place").get() as unknown as { c: number };
    const started = performance.now();
    const stats = buildSearchIndex(allPlaces(db!));
    const elapsed = performance.now() - started;

    assert.equal(stats.places, count.c);
    assert.ok(stats.buildMs < 150, `build took ${stats.buildMs.toFixed(1)} ms, budget 150 ms`);
    assert.ok(elapsed < 150, `boot read and build took ${elapsed.toFixed(1)} ms, budget 150 ms`);
    assert.ok(stats.bytes < 8 * 1024 * 1024, `index footprint ${(stats.bytes / 1048576).toFixed(2)} MB, budget 8 MB`);
    assert.equal(indexStats()?.buildMs, stats.buildMs);
  });
});

describe("a fixture", () => {
  const places: Place[] = [
    fixture("2900000", "place", "Springfield city, Missouri", "Springfield city", "MO", 169176, "29"),
    fixture("2500000", "place", "Springfield city, Massachusetts", "Springfield city", "MA", 155929, "25"),
    fixture("1700000", "place", "Springfield city, Illinois", "Springfield city", "IL", 114394, "17"),
    fixture("4200000", "place", "Springfield city, Pennsylvania", "Springfield city", "PA", 100000, "42"),
    fixture("9900000", "county", "Springfield County, Anywhere", "Springfield County", "XX", 50000, "99"),
    fixture("0500000", "place", "West Springfield town, Massachusetts", "West Springfield town", "MA", 28500, "25"),
    fixture("0600000", "place", "Springdale city, Arkansas", "Springdale city", "AR", 84000, "05"),
  ];

  test("ranking is deterministic and the biggest Springfield wins", () => {
    buildSearchIndex(places);
    const once = searchIndex("Springfield", 10).map((place) => place.geoid);
    buildSearchIndex(places);
    const twice = searchIndex("Springfield", 10).map((place) => place.geoid);

    assert.deepEqual(twice, once);
    assert.deepEqual(once.slice(0, 4), ["2900000", "2500000", "1700000", "4200000"]);
  });

  test("a typo still finds the name, biggest first", () => {
    buildSearchIndex(places);
    assert.equal(searchIndex("Springfeild", 5)[0]?.geoid, "2900000");
  });

  test("prefix matches rank before substring matches", () => {
    buildSearchIndex(places);
    const geoids = searchIndex("Springf", 10).map((place) => place.geoid);
    const west = geoids.indexOf("0500000");
    const springfield = geoids.indexOf("2900000");
    assert.ok(springfield > -1, "Springfield is not in the result");
    assert.ok(west === -1 || springfield < west, "a substring match outranked a prefix match");
  });

  test("a population tie falls to county, then geoid", () => {
    buildSearchIndex([
      fixture("2", "place", "Twin Falls city, Idaho", "Twin Falls city", "ID", 50000, "16"),
      fixture("1", "county", "Twin Falls County, Idaho", "Twin Falls County", "ID", 50000, "16"),
    ]);
    const geoids = searchIndex("Twin Falls", 2).map((place) => place.geoid);
    assert.deepEqual(geoids, ["1", "2"]);
  });

  test("the limit is honoured and an empty query returns nothing", () => {
    buildSearchIndex(places);
    assert.equal(searchIndex("Springfield", 2).length, 2);
    assert.deepEqual(searchIndex("", 10), []);
    assert.deepEqual(searchIndex("zzzzz", 10), []);
  });

  test("norm drops the place-type suffix and keeps county", () => {
    assert.equal(normalizeName("Philadelphia city"), "philadelphia");
    assert.equal(normalizeName("East Pittsburgh borough"), "east pittsburgh");
    assert.equal(normalizeName("Philadelphia County"), "philadelphia county");
    assert.equal(normalizeName("West Springfield town"), "west springfield");
  });
});
