/**
 * The type-ahead: the JSON the box draws, and the route that serves it.
 *
 * The ranking is #6's, so these tests pin what #7 adds: the row shape, the
 * eight-row cap, the 80-character ceiling, the cache header, the script the
 * asset route serves, and a three-character answer inside the 100 ms budget.
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import { MAX_QUERY, MIN_QUERY, SUGGEST_LIMIT, routeSuggest, suggestionsFor } from "../server/routes/suggest.ts";
import { routeAssets } from "../server/routes/assets.ts";
import { shell } from "../server/views/layout.ts";

const FIELDS = ["geoid", "kind", "name", "population", "stateCode"];

interface Captured {
  code: number;
  headers: Record<string, string>;
  body: string;
}

/** A response object `send()` can write to, so the route is testable without a port. */
function fakeResponse(): { res: ServerResponse; captured: Captured } {
  const captured: Captured = { code: 0, headers: {}, body: "" };
  const res = {
    writeHead(code: number, headers: Record<string, string>) {
      captured.code = code;
      captured.headers = headers;
    },
    end(body?: string) {
      captured.body = String(body ?? "");
    },
  } as unknown as ServerResponse;
  return { res, captured };
}

async function call(
  route: (url: URL, res: ServerResponse) => Promise<boolean>,
  path: string,
): Promise<{ handled: boolean } & Captured> {
  const { res, captured } = fakeResponse();
  const handled = await route(new URL(`http://localhost${path}`), res);
  return { handled, ...captured };
}

function answer(path: string): Promise<{ handled: boolean } & Captured> {
  return call(routeSuggest, path);
}

test("a row carries the five fields the combobox draws", () => {
  const first = suggestionsFor("Phila")[0];
  assert.ok(first, "Phila returned no suggestion");
  assert.deepEqual(Object.keys(first).sort(), FIELDS);
  assert.equal(first.geoid, "42101");
  assert.equal(first.name, "Philadelphia County, Pennsylvania");
  assert.equal(first.kind, "county");
  assert.equal(first.stateCode, "PA");
  assert.equal(first.population, 1579706);
});

test("a city and its county are both offered, and the kind separates them", () => {
  const rows = suggestionsFor("Phila");
  const kinds = new Set(rows.map((row) => row.kind));
  assert.ok(kinds.has("county"), "no county in the list");
  assert.ok(kinds.has("place"), "no place in the list");
  assert.equal(rows.find((row) => row.geoid === "4260000")?.kind, "place");
});

test("an alias answers like an exact name", () => {
  const rows = suggestionsFor("Philly");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.geoid, "42101");
});

test("the list stops at eight", () => {
  const rows = suggestionsFor("an");
  assert.equal(rows.length, SUGGEST_LIMIT);
  assert.equal(new Set(rows.map((row) => row.geoid)).size, rows.length);
});

test("a query shorter than two characters returns nothing", () => {
  assert.equal(MIN_QUERY, 2);
  assert.deepEqual(suggestionsFor("p"), []);
  assert.deepEqual(suggestionsFor("  "), []);
});

test("a query over the cap is dropped before it is read", () => {
  assert.equal(MAX_QUERY, 80);
  const started = performance.now();
  assert.deepEqual(suggestionsFor("x".repeat(200_000)), []);
  assert.ok(performance.now() - started < 100, "the cap did not stop the query from being read");
});

test("the route answers JSON, cacheably, and a missing query is an empty list", async () => {
  const ok = await answer("/api/suggest?q=Phila");
  assert.equal(ok.handled, true);
  assert.equal(ok.code, 200);
  assert.match(ok.headers["content-type"] ?? "", /^application\/json/);
  assert.match(ok.headers["cache-control"] ?? "", /max-age=\d+/);
  const body = JSON.parse(ok.body) as { suggestions: Array<{ geoid: string }> };
  assert.equal(body.suggestions[0]?.geoid, "42101");

  const empty = await answer("/api/suggest");
  assert.equal(empty.code, 200);
  assert.deepEqual(JSON.parse(empty.body), { suggestions: [] });
});

test("the route owns only its one path", async () => {
  assert.equal((await answer("/api/nope")).handled, false);
  assert.equal((await answer("/combobox.js")).handled, false);
  assert.equal((await answer("/s?q=Phila")).handled, false);
});

test("a three-character query answers in under 100 ms server-side", async () => {
  for (let i = 0; i < 5; i += 1) await answer("/api/suggest?q=Phi");

  const runs = 30;
  let slowest = 0;
  const started = performance.now();
  for (let i = 0; i < runs; i += 1) {
    const at = performance.now();
    await answer("/api/suggest?q=Phi");
    slowest = Math.max(slowest, performance.now() - at);
  }
  const mean = (performance.now() - started) / runs;
  assert.ok(mean < 100, `${mean.toFixed(2)} ms mean, budget 100 ms`);
  assert.ok(slowest < 100, `${slowest.toFixed(2)} ms slowest, budget 100 ms`);
});

test("the asset route serves the combobox script", async () => {
  const script = await call(routeAssets, "/combobox.js");
  assert.equal(script.handled, true);
  assert.equal(script.code, 200);
  assert.match(script.headers["content-type"] ?? "", /^text\/javascript/);
  assert.match(script.body, /aria-activedescendant/);
  assert.match(script.body, /\/api\/suggest/);
});

test("every page loads the combobox exactly once", () => {
  for (const page of [shell("Test", "<p>x</p>"), shell("Test", "<p>x</p>", { docked: false })]) {
    assert.equal(page.match(/src="\/combobox\.js"/g)?.length, 1);
    assert.ok(page.includes('<script src="/combobox.js" defer></script>'));
  }
});
