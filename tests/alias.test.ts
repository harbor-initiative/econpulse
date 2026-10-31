/**
 * The alias layer, tested against the committed CSVs and the open database.
 *
 * The acceptance list is the test list: four human names that used to return
 * nothing, one precedence rule, and one hard failure. The exact-name case uses
 * the district because it is the one term in the data where an alias and an
 * exact name point at different rows.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { openStore, searchPlaces, storePath } from "../server/store.ts";
import { aliasGeoid, buildAliasMap, normalizeTerm, readAliasRows } from "../server/lib/aliases.ts";

const db = openStore(storePath());

function first(query: string) {
  return searchPlaces(db, query, 5)[0] ?? null;
}

test("Philly resolves to Philadelphia County", () => {
  const place = first("Philly");
  assert.equal(place?.geoid, "42101");
  assert.equal(place?.name, "Philadelphia County, Pennsylvania");
});

test("NYC resolves to New York County", () => {
  const place = first("NYC");
  assert.equal(place?.geoid, "36061");
  assert.equal(place?.name, "New York County, New York");
});

test("DC resolves to the District of Columbia", () => {
  const place = first("DC");
  assert.equal(place?.geoid, "11");
  assert.equal(place?.name, "District of Columbia");
});

test("Bay Area resolves to a defined metro recorded in the CSV", () => {
  const rows = readAliasRows();
  const bay = rows.find((row) => row.term === "bay area");
  assert.ok(bay, "bay area is not in the alias CSVs");
  assert.equal(bay.geoid, "06075");
  assert.equal(rows.find((row) => row.term === "san francisco" && row.kind === "metro")?.geoid, "06075");
  assert.equal(first("Bay Area")?.geoid, "06075");
});

test("an alias never overrides an exact name match", () => {
  // The CSVs point the district's full name at the state row; the exact county
  // row has the same name and must win.
  assert.equal(aliasGeoid("District of Columbia"), "11");
  assert.equal(first("District of Columbia")?.geoid, "11001");
});

test("a duplicate term fails with both GEOIDs named", () => {
  assert.throws(
    () => buildAliasMap([
      { term: "philly", geoid: "42101", kind: "nickname" },
      { term: "philly", geoid: "36061", kind: "nickname" },
    ]),
    /Alias "philly" maps to both 42101 and 36061/,
  );
});

test("the committed CSVs hold no conflicting term", () => {
  assert.doesNotThrow(() => buildAliasMap(readAliasRows()));
});

test("every alias points at a place in the database", () => {
  const place = db.prepare("SELECT 1 AS found FROM place WHERE geoid = ?");
  for (const [term, geoid] of buildAliasMap(readAliasRows())) {
    assert.ok(place.get(geoid), `${term} points at missing place ${geoid}`);
  }
});

test("case and punctuation do not change the term", () => {
  assert.equal(normalizeTerm("H-Town"), "h town");
  assert.equal(aliasGeoid("H-Town"), "48201");
});
