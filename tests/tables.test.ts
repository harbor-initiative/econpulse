/**
 * The table under the chart has to say what the chart says.
 *
 * The chart is an `aria-hidden` SVG, so for a screen reader the table is the
 * panel. A table that disagrees with its chart is worse than no table: the two
 * audiences get different numbers from the same page.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { renderPanel, type Panel } from "../server/views/panel.ts";
import type { Fact } from "../server/store.ts";

function fact(period: string, value: number, moe: number | null = 1200): Fact {
  return {
    metric: "population",
    period,
    value,
    unit: "people",
    label: "Population",
    agency: "U.S. Census Bureau",
    dataset: "ACS 5-year",
    table_id: "B01003",
    vintage: "2024",
    retrieved_at: "2026-10-31",
    moe,
    revision: null,
    note: null,
  };
}

function panel(history: Fact[], comparison: Fact[] = [], comparisonLabel: string | null = null): Panel {
  return {
    metric: "population",
    label: "Population",
    fact: history[history.length - 1] ?? null,
    history,
    comparison,
    comparisonLabel,
    benchmarks: [],
    missingBenchmarks: [],
  };
}

test("a chart carries a table with the full series", () => {
  const html = renderPanel(panel([fact("2020", 1500000), fact("2024", 1579706)]));
  assert.match(html, /data-chart-table/);
  const rows = html.match(/<tr><th scope="row">/g) ?? [];
  assert.equal(rows.length, 2, "one row per period");
});

test("the table prints the values the chart draws", () => {
  const history = [fact("2020", 1500000), fact("2024", 1579706)];
  const html = renderPanel(panel(history));
  for (const row of history) {
    assert.ok(html.includes(row.value.toLocaleString("en-US")), `${row.value} appears in the table`);
  }
});

test("a two-series chart gets the comparison column, named", () => {
  const history = [fact("2023", 100), fact("2024", 110)];
  const comparison = [fact("2023", 300), fact("2024", 320)];
  const html = renderPanel(panel(history, comparison, "United States"));
  assert.match(html, /<th scope="col">United States<\/th>/);
  assert.ok(html.includes("320"), "the national value is in the table");
});

test("an absent margin is an em dash, and a zero never appears in its place", () => {
  const html = renderPanel(panel([fact("2020", 1500000, null), fact("2024", 1579706, null)]));
  assert.ok(html.includes("—"), "the dash is used for an absent margin");
  assert.doesNotMatch(html, /<td>±0<\/td>/, "an absent margin is not rounded to zero");
});

test("a single-value panel has no chart and no table", () => {
  const html = renderPanel(panel([fact("2024", 1579706)]));
  assert.doesNotMatch(html, /data-chart-table/);
});

test("the chart itself stays hidden from assistive technology", () => {
  const html = renderPanel(panel([fact("2020", 1500000), fact("2024", 1579706)]));
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
});
