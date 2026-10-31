/**
 * Every panel carries a benchmark, or says why it cannot.
 *
 * These run against the real file, because the thing under test is whether the
 * measures actually published for one place line up with the rows the page
 * promises. A fixture would answer that question about the fixture.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { openStore, getPlace } from "../server/store.ts";
import { buildPanels, panelFor, contextFor } from "../server/lib/panels.ts";
import { REPORT_ORDER } from "../server/lib/metrics.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";

const db = skip ? null : openStore(DB);

test("every report panel shows at least two benchmarks or explains the absence", { skip }, () => {
  const place = getPlace(db!, "42101");
  assert.ok(place, "Philadelphia County is in the file");
  const panels = buildPanels(place!);
  assert.equal(panels.length, REPORT_ORDER.length);

  for (const panel of panels) {
    if (!panel.fact) continue;
    const rows = panel.benchmarks ?? [];
    const absent = panel.missingBenchmarks ?? [];
    assert.ok(
      rows.length > 1 || absent.length > 0,
      `${panel.label} has ${rows.length} benchmark row(s) and no explanation`,
    );
  }
});

test("a measure the nation does not publish names the gap", { skip }, () => {
  const place = getPlace(db!, "42101");
  const ctx = contextFor(place!);
  const gdp = panelFor(place!, "gdp", ctx.available, ctx.county, ctx.countyMetrics);

  assert.ok(gdp.fact, "the county publishes output");
  const roles = (gdp.benchmarks ?? []).map((row) => row.role);
  assert.ok(roles.includes("state"), "the state row is present");
  assert.ok(!roles.includes("nation"), "the nation row is absent");
  assert.ok((gdp.missingBenchmarks ?? []).includes("national series"));
});

test("a missing benchmark never becomes a zero row", { skip }, () => {
  const place = getPlace(db!, "42101");
  const panels = buildPanels(place!);
  for (const panel of panels) {
    for (const row of panel.benchmarks ?? []) {
      assert.notEqual(row.value, 0, `${panel.label} draws a zero for ${row.label}`);
    }
  }
});

test("a rate compares on one axis, with three rows", { skip }, () => {
  const place = getPlace(db!, "42101");
  const ctx = contextFor(place!);
  const unemployment = panelFor(place!, "unemployment_rate", ctx.available, ctx.county, ctx.countyMetrics);
  const roles = (unemployment.benchmarks ?? []).map((row) => row.role);
  assert.deepEqual(roles, ["place", "state", "nation"]);
  assert.equal(unemployment.fact?.unit, "percent");
});

test("a state page is not its own benchmark", { skip }, () => {
  const state = getPlace(db!, "42");
  assert.ok(state, "Pennsylvania is in the file");
  const ctx = contextFor(state!);
  const population = panelFor(state!, "population", ctx.available, ctx.county, ctx.countyMetrics);
  const roles = (population.benchmarks ?? []).map((row) => row.role);
  assert.ok(!roles.includes("state"), "a state row would duplicate the place");
  assert.ok(roles.includes("nation"));
});
