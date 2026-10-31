/**
 * Where somebody is.
 *
 * A wrong answer here sends a reader to a page about a place they are not in,
 * which is worse than a button that says it could not find them. The cases are
 * real coordinates with known answers.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { inRing, placeAt } from "../server/lib/where.ts";

const DIR = path.join(import.meta.dirname, "..", "data", "boundaries");
const skip = existsSync(path.join(DIR, "state-42.json")) ? false : "data/boundaries is not built";

test("a point inside a square is inside, one outside is not", () => {
  const square = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
  assert.equal(inRing(1, 1, square), true);
  assert.equal(inRing(3, 1, square), false);
});

test("a diamond contains its middle and nothing outside", () => {
  const diamond = [[1, 0], [2, 1], [1, 2], [0, 1], [1, 0]];
  assert.equal(inRing(1, 1, diamond), true);
  assert.equal(inRing(1, -1, diamond), false);
  assert.equal(inRing(1.5, 1, diamond), true);
});

test("a point exactly on a vertex is not guaranteed", () => {
  // Ray casting excludes a point that lands precisely on a vertex. A GPS fix
  // never does, and a reader standing on the corner of a municipal boundary is
  // an edge case where either answer is defensible. Recorded rather than hidden.
  const diamond = [[1, 0], [2, 1], [1, 2], [0, 1], [1, 0]];
  assert.equal(inRing(1, 2, diamond), false);
});

test("City Hall, Philadelphia is Philadelphia city", { skip }, () => {
  assert.equal(placeAt(-75.1635, 39.9526)?.geoid, "4260000");
});

test("downtown Austin is Austin city", { skip }, () => {
  assert.equal(placeAt(-97.7431, 30.2672)?.geoid, "4805000");
});

test("the Atlantic is nobody's place", { skip }, () => {
  assert.equal(placeAt(-70, 39), null);
});

test("a city wins over the county that contains it", { skip }, () => {
  // Philadelphia city and Philadelphia County share a boundary; the city is the
  // answer a reader expects from standing in it.
  const found = placeAt(-75.1635, 39.9526);
  assert.equal(found?.kind, "place");
});
