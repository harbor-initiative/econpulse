/**
 * Two places, and the three ways that can go.
 *
 * The failure this guards against is the quiet one: a comparison question that
 * resolves one name and renders a single-place report, so the reader believes
 * they are looking at a comparison.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { openStore } from "../server/store.ts";
import { parseLocally, parseComparison, wantsComparison } from "../server/ask.ts";
import { sharedMetrics } from "../server/lib/panels.ts";
import { compareCard, compareEmpty } from "../server/views/ask.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";
const db = skip ? null : openStore(DB);

test("a comparison is only read when it was asked for", () => {
  assert.equal(wantsComparison("Austin vs Nashville"), true);
  assert.equal(wantsComparison("Austin versus Nashville"), true);
  assert.equal(wantsComparison("Austin compared to Nashville"), true);
  assert.equal(wantsComparison("Population of Austin"), false);
});

test("both names resolve through the index, with no model", { skip }, () => {
  const parsed = parseComparison(db!, "Philadelphia vs Pittsburgh");
  assert.ok(parsed?.place, "the first place resolves");
  assert.ok(parsed?.comparePlace, "the second place resolves");
  assert.notEqual(parsed?.place?.geoid, parsed?.comparePlace?.geoid);
});

test("two places share the measures they both publish", { skip }, () => {
  const parsed = parseComparison(db!, "Austin vs Nashville")!;
  const rows = sharedMetrics(parsed.place!, parsed.comparePlace!);
  assert.ok(rows.length >= 3, `${rows.length} shared measures`);
  for (const row of rows) {
    assert.ok(row.a.length > 0 && row.b.length > 0, `${row.metric} has both sides`);
  }
});

test("the page names both places and draws both series", { skip }, () => {
  const parsed = parseComparison(db!, "Austin vs Nashville")!;
  const a = parsed.place!;
  const b = parsed.comparePlace!;
  const rows = sharedMetrics(a, b);
  const html = compareCard("Austin vs Nashville", a, b, rows, null);
  assert.match(html, new RegExp(a.name.slice(0, 12)), "the first place is named");
  assert.match(html, new RegExp(b.name.slice(0, 12)), "the second place is named");
  assert.match(html, /class="legend"/, "at least one chart carries a legend");
  assert.equal((html.match(/class="metric full"/g) ?? []).length, rows.length);
});

test("an unknown second name drops to one place and says which", { skip }, () => {
  const parsed = parseLocally(db!, "Philadelphia vs Xyzzyville");
  assert.ok(parsed.place, "the half that exists is answered");
  assert.equal(parsed.comparePlace ?? null, null);
  assert.equal(parsed.dropped, "Xyzzyville");
});

test("two places with nothing in common get a page that says so", { skip }, () => {
  const parsed = parseComparison(db!, "Austin vs Nashville")!;
  const html = compareEmpty("Austin vs Nashville", parsed.place!, parsed.comparePlace!);
  assert.match(html, /no measures in common/);
  assert.match(html, /noindex/);
});
