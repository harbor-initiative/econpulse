/**
 * The freshness thresholds, and the three treatments they choose.
 *
 * Two things are worth testing here and one is not. The boundaries are worth it,
 * because an off-by-one at 35 or 120 days changes what a reader sees. The clamp
 * is worth it, because the machine clock and the build date disagree and a
 * negative age would print "-1 days ago". Whether the CSS is amber is not.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { FRESHNESS, ageInDays, bandFor, bandOf, spanBand } from "../server/lib/freshness.ts";
import { renderPanel, type Panel } from "../server/views/panel.ts";
import type { Fact } from "../server/store.ts";

const NOW = new Date("2026-10-30T12:00:00Z");

test("age counts whole days", () => {
  assert.equal(ageInDays("2026-10-01", NOW), 29);
  assert.equal(ageInDays("2026-10-30", NOW), 0);
});

test("a retrieval date in the future clamps to zero", () => {
  assert.equal(ageInDays("2026-11-15", NOW), 0);
});

test("an unparseable date reads as fresh rather than throwing", () => {
  assert.equal(ageInDays("not a date", NOW), 0);
});

test("the bands meet at the documented boundaries", () => {
  assert.equal(bandFor(0), "fresh");
  assert.equal(bandFor(FRESHNESS.agingAfterDays - 1), "fresh");
  assert.equal(bandFor(FRESHNESS.agingAfterDays), "aging");
  assert.equal(bandFor(FRESHNESS.staleAfterDays), "aging");
  assert.equal(bandFor(FRESHNESS.staleAfterDays + 1), "stale");
});

test("bandOf agrees with bandFor through a date", () => {
  const staleDate = "2026-05-01";
  assert.equal(bandOf(staleDate, NOW), bandFor(ageInDays(staleDate, NOW)));
  assert.equal(bandOf(staleDate, NOW), "stale");
});

test("an empty file is fresh, not stale", () => {
  assert.equal(spanBand({ oldest: null, newest: null }, NOW), "fresh");
  assert.equal(spanBand({ oldest: "2026-01-01", newest: "2026-01-01" }, NOW), "stale");
});

function panelWith(retrievedAt: string): Panel {
  const fact: Fact = {
    metric: "population",
    period: "2020-2024",
    value: 1579706,
    unit: "people",
    label: "Population",
    agency: "U.S. Census Bureau",
    dataset: "ACS 5-year",
    table_id: "B01003",
    vintage: "2024",
    retrieved_at: retrievedAt,
    moe: 0,
    revision: null,
    note: null,
  };
  return {
    metric: "population",
    label: "Population",
    fact,
    history: [fact],
    comparison: [],
    comparisonLabel: null,
  };
}

test("a stale panel says so, with the source and the age", () => {
  const html = renderPanel(panelWith("2026-01-01"));
  assert.match(html, /class="stale"/);
  assert.match(html, /U\.S\. Census Bureau/);
  assert.match(html, /data-freshness="stale"/);
});

test("an aging panel prints its age in the receipt", () => {
  const html = renderPanel(panelWith("2026-08-01"));
  assert.doesNotMatch(html, /class="stale"/);
  assert.match(html, /data-freshness="aging"/);
  assert.match(html, /days old/);
});

test("a fresh panel renders no strip", () => {
  const html = renderPanel(panelWith(new Date().toISOString().slice(0, 10)));
  assert.doesNotMatch(html, /class="stale"/);
  assert.match(html, /data-freshness="fresh"/);
});
