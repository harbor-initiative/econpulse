/**
 * A dashed line with a delta about something else is a chart that lies while
 * every part of it is individually correct.
 *
 * These assert that the legend, the two lines, and the number beside them all
 * come from the same pair of arrays.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { seriesReadout } from "../server/views/charts.ts";
import type { Fact } from "../server/store.ts";

function fact(period: string, value: number, unit = "percent"): Fact {
  return {
    metric: "unemployment_rate",
    period,
    value,
    unit,
    label: "Unemployment",
    agency: "U.S. Bureau of Labor Statistics",
    dataset: "Local Area Unemployment Statistics",
    table_id: "LAUS",
    vintage: "2026",
    retrieved_at: "2026-10-31",
    moe: null,
    revision: null,
    note: null,
  };
}

const place = [fact("2026-08", 5.0), fact("2026-09", 4.3)];
const nation = [fact("2026-08", 4.4), fact("2026-09", 4.0)];

test("two series get a legend naming both, in draw order", () => {
  const { legend } = seriesReadout(place, nation, "United States");
  assert.match(legend, /This place/);
  assert.match(legend, /United States/);
  assert.ok(legend.indexOf("This place") < legend.indexOf("United States"), "draw order");
});

test("one series gets no legend", () => {
  const { legend } = seriesReadout(place, [], null);
  assert.equal(legend, "");
});

test("the delta is about the comparison the chart draws", () => {
  const { delta } = seriesReadout(place, nation, "United States");
  assert.match(delta, /United States/, "the delta names the comparison");
  assert.match(delta, /\+0\.3 pts above/, "4.3 against 4.0");
});

test("a direction is a word, never a colour", () => {
  const below = seriesReadout([fact("2026-09", 3.0)], [], null);
  assert.equal(below.delta, "", "one period has nothing to compare");
  const gap = seriesReadout([fact("2026-09", 3.0)], [fact("2026-09", 4.0)], "United States");
  assert.match(gap.delta, /below/);
});

test("a single series keeps the change since the previous period", () => {
  const { delta, legend } = seriesReadout(place, [], null);
  assert.match(delta, /vs 2026-08/);
  assert.equal(legend, "");
});

test("the chart and the delta come from the same call", () => {
  const readout = seriesReadout(place, nation, "United States");
  assert.ok(readout.chart.includes("<svg"));
  assert.equal((readout.chart.match(/<polyline/g) ?? []).length, 2, "two lines are drawn");
  assert.match(readout.chart, /stroke-dasharray/, "the second is the dashed comparison");
  assert.ok(readout.delta.includes("United States"));
});
