/**
 * The outline is ours.
 *
 * A page that draws its boundary from a third party shows nothing when that
 * party is unreachable. These assert the file is on our origin, one feature at a
 * time, and that a geoid with no outline says so instead of drawing an empty box.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { boundaryFor, mapCentre } from "../server/lib/boundaries.ts";

const DIR = path.join(import.meta.dirname, "..", "data", "boundaries");
const skip = existsSync(path.join(DIR, "state-42.json")) ? false : "data/boundaries is not built";

test("a county resolves to one feature", { skip }, () => {
  const body = boundaryFor("42101");
  assert.ok(body, "Philadelphia County has an outline");
  const parsed = JSON.parse(body!) as { type: string; features: Array<{ properties: { GEOID: string } }> };
  assert.equal(parsed.type, "FeatureCollection");
  assert.equal(parsed.features.length, 1);
  assert.equal(parsed.features[0]?.properties.GEOID, "42101");
});

test("a city draws its own outline", { skip }, () => {
  const body = boundaryFor("4260000");
  assert.ok(body, "Philadelphia city has a shape of its own");
  const parsed = JSON.parse(body!) as { features: Array<{ properties: { GEOID: string } }> };
  assert.equal(parsed.features.length, 1);
  assert.equal(parsed.features[0]?.properties.GEOID, "4260000");
});

test("a state draws all of its counties", { skip }, () => {
  const body = boundaryFor("42");
  assert.ok(body);
  const parsed = JSON.parse(body!) as { features: unknown[] };
  assert.ok(parsed.features.length > 50, `${parsed.features.length} counties`);
});

test("a geoid with no outline is null, not an empty collection", { skip }, () => {
  assert.equal(boundaryFor("99999"), null);
});

test("the centre comes from the geometry, not from a guess", { skip }, () => {
  const centre = mapCentre("42101");
  assert.ok(centre);
  assert.ok(centre!.center[0] < -74 && centre!.center[0] > -76, "longitude inside Pennsylvania");
  assert.ok(centre!.center[1] > 39 && centre!.center[1] < 41, "latitude inside Pennsylvania");
});
