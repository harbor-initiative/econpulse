/**
 * The sentence under the score.
 *
 * Three ways it can be wrong, and each one has a test: it repeats a number the
 * page already shows, it tells the reader what to do, or it names a measure that
 * is not there. All three are checked before the text reaches the page, and a
 * failure falls back to a template built from the same facts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { accept, template, summarise, resetSummaries, type SummaryInput } from "../server/lib/summary.ts";
import type { Fact } from "../server/store.ts";

const LABELS = ["Population", "Unemployment", "Median gross rent", "Output", "Federal obligations"];

function fact(value: number, unit = "percent"): Fact {
  return {
    metric: "unemployment_rate", period: "2026-09", value, unit, label: "Unemployment",
    agency: "U.S. Bureau of Labor Statistics", dataset: "LAUS", table_id: "LAUS",
    vintage: "2026", retrieved_at: "2026-10-31", moe: null, revision: null, note: null,
  };
}

const input: SummaryInput = {
  placeName: "Philadelphia County, Pennsylvania",
  panels: [
    { label: "Unemployment", fact: fact(4.3), mark: "worse" },
    { label: "Median gross rent", fact: fact(1397, "usd_per_month"), mark: "better" },
  ],
};

test("a sentence with a digit is refused", () => {
  assert.equal(accept("Unemployment is 4.3 percent, above the nation.", LABELS), false);
});

test("advice is refused", () => {
  assert.equal(accept("You should consider moving for better rent.", LABELS), false);
  assert.equal(accept("We recommend comparing counties.", LABELS), false);
});

test("a measure the page does not carry is refused", () => {
  // Poverty is a real measure in this file and not one of these five panels.
  assert.equal(accept("Poverty is worse than the nation here.", LABELS), false);
  // Education likewise.
  assert.equal(accept("Education is better than the nation.", LABELS), false);
});

test("a plain sentence about the measures present is accepted", () => {
  assert.equal(accept("Rent here is easier than the national figure, while unemployment is harder.", LABELS), true);
});

test("the template names only measures with a direction", () => {
  const text = template(input);
  assert.match(text, /unemployment/i);
  assert.match(text, /better than the national figure|worse than the national figure/);
  assert.doesNotMatch(text, /[0-9]/);
});

test("no panels with a direction still produces a sentence", () => {
  const text = template({ placeName: "Somewhere", panels: [{ label: "Population", fact: fact(1000, "people"), mark: null }] });
  assert.ok(text.length > 20);
  assert.doesNotMatch(text, /[0-9]/);
});

test("a second render of the same place makes no model call", async () => {
  resetSummaries();
  delete process.env.OPENROUTER_API_KEY; // the template path, twice
  const first = await summarise(input, "2026.10");
  const second = await summarise(input, "2026.10");
  assert.equal(first.text, second.text);
  assert.equal(second.source, "template");
});

test("the template is what a failed model falls back to", async () => {
  resetSummaries();
  delete process.env.OPENROUTER_API_KEY;
  const result = await summarise(input, "2026.10");
  assert.equal(result.source, "template");
  assert.doesNotMatch(result.text, /[0-9]/);
});
