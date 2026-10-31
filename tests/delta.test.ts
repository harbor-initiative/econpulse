/**
 * A direction, in a word.
 *
 * Red and green are forbidden here because colour on a change says good or bad
 * when it can only say up or down. The word says which, in ink, and survives a
 * printed page, greyscale, and a screen reader.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { openStore, getPlace } from "../server/store.ts";
import { panelFor, contextFor } from "../server/lib/panels.ts";
import { renderPanel } from "../server/views/panel.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";
const db = skip ? null : openStore(DB);

function panel(geoid: string, metric: string) {
  const place = getPlace(db!, geoid)!;
  const ctx = contextFor(place);
  return { place, panel: panelFor(place, metric, ctx.available, ctx.county, ctx.countyMetrics) };
}

test("lower unemployment than the nation is better", { skip }, () => {
  // Philadelphia County is at 4.3% against a national 4.0%; lower is better.
  const { panel: p } = panel("42101", "unemployment_rate");
  assert.equal(p.mark, "worse");
});

test("lower rent than the nation is better", { skip }, () => {
  const { panel: p } = panel("42101", "median_gross_rent");
  assert.equal(p.mark, "better");
});

test("a neutral measure carries no mark", { skip }, () => {
  for (const metric of ["population", "gdp", "federal_obligations", "median_age"]) {
    const { panel: p } = panel("42101", metric);
    assert.equal(p.mark ?? null, null, `${metric} has no direction`);
  }
});

test("the mark is a word, not a colour", { skip }, () => {
  const { panel: p } = panel("42101", "unemployment_rate");
  const html = renderPanel(p);
  assert.match(html, /<span class="mark" data-mark="worse">worse<\/span>/);
  assert.doesNotMatch(html, /#[0-9A-Fa-f]{6}[^<]*mark|mark[^>]*color:(red|green)/i);
});

test("a mark with no delta says what it is better than", { skip }, () => {
  const { panel: p } = panel("42101", "median_gross_rent");
  const html = renderPanel(p);
  assert.match(html, /than the United States/);
});
