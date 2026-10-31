/**
 * No panel is a number and a receipt.
 *
 * The defect the design audit named first was a cell with a value, a provenance
 * line, and empty paper. Three visuals are allowed and this asserts that every
 * report panel takes one of them.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { openStore, getPlace } from "../server/store.ts";
import { buildPanels, contextFor, panelFor } from "../server/lib/panels.ts";
import { renderPanel } from "../server/views/panel.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";
const db = skip ? null : openStore(DB);

const VISUAL = /(<svg|class="compare"|data-visual)/;

test("every report panel contains a visual", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  for (const panel of buildPanels(place)) {
    const html = renderPanel(panel);
    assert.match(html, VISUAL, `${panel.label} is a number and a receipt`);
  }
});

test("a single-period total gets a share bar, not a fake axis", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  const ctx = contextFor(place);
  const population = panelFor(place, "population", ctx.available, ctx.county, ctx.countyMetrics);
  const html = renderPanel(population);

  assert.equal(population.history.length, 1, "population has one period in this file");
  assert.match(html, /class="sharebar"/);
  assert.match(html, /% of Pennsylvania/, "the parent is named");
  assert.doesNotMatch(html, /<svg/, "no series is invented for one value");
});

test("a series still wins over a share bar", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  const ctx = contextFor(place);
  const unemployment = panelFor(place, "unemployment_rate", ctx.available, ctx.county, ctx.countyMetrics);
  const html = renderPanel(unemployment);
  assert.match(html, /<svg/);
  assert.doesNotMatch(html, /class="sharebar"/);
});

test("comparable units compare on one scale, and the bars print their numbers", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  const ctx = contextFor(place);
  const rent = panelFor(place, "median_gross_rent", ctx.available, ctx.county, ctx.countyMetrics);
  const html = renderPanel(rent);
  assert.match(html, /class="compare"/);
  assert.equal((html.match(/class="crow"/g) ?? []).length, 3, "place, state, nation");
  assert.match(html, /\$1,397/);
});
