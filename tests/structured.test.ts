/**
 * What a crawler is told, and what it must never be told.
 *
 * The interesting failure here is not a missing tag. It is a tag that claims
 * something untrue about a place, which a search result then repeats to
 * everybody.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { openStore, getPlace } from "../server/store.ts";
import { buildPanels } from "../server/lib/panels.ts";
import { placeJsonLd } from "../server/lib/structured.ts";
import { sitemap } from "../server/lib/sitemap.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";
const db = skip ? null : openStore(DB);
const meta = { "data.version": "2026.10" };

test("a place page advertises the place, the dataset and the trail", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  const blocks = placeJsonLd(place, buildPanels(place), meta);
  const types = blocks.map((block) => block["@type"]);
  assert.deepEqual(types, ["Place", "Dataset", "BreadcrumbList"]);
});

test("no page claims a rating for a place", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  const serialised = JSON.stringify(placeJsonLd(place, buildPanels(place), meta));
  assert.doesNotMatch(serialised, /AggregateRating/);
  assert.doesNotMatch(serialised, /"Review"/);
});

test("the place name is not duplicated with its state", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  const [node] = placeJsonLd(place, buildPanels(place), meta);
  const name = String(node?.name ?? "");
  assert.doesNotMatch(name, /Pennsylvania, PA/, name);
  assert.match(name, /Philadelphia County/);
});

test("the dataset carries the numbers and their provenance", { skip }, () => {
  const place = getPlace(db!, "42101")!;
  const blocks = placeJsonLd(place, buildPanels(place), meta);
  const dataset = blocks.find((block) => block["@type"] === "Dataset")!;
  const variables = dataset.variableMeasured as Array<{ name: string; description: string }>;
  assert.ok(variables.length >= 3, "the panel values are in the dataset");
  assert.match(variables[0]!.description, /retrieved/);
});

test("the sitemap is an index of state files, and each one is a urlset", { skip }, () => {
  const { index, states } = sitemap(db!);
  assert.match(index, /<sitemapindex/);
  assert.match(index, /sitemaps\.org/);
  const files = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(files.length > 50, `${files.length} child sitemaps`);
  for (const [key, body] of states) {
    assert.match(body, /<urlset/, key);
    assert.ok(body.includes("<url>"), `${key} has at least one URL`);
  }
});

test("every sitemap URL is on the canonical host", { skip }, () => {
  const { index, states } = sitemap(db!);
  const urls = [index, ...states.values()].join("\n").match(/<loc>[^<]+<\/loc>/g) ?? [];
  for (const url of urls) {
    assert.match(url, /^<loc>https:\/\/econpulse\.harborgovcon\.com\//, url);
  }
});
