/**
 * The six states of the question box.
 *
 * Every failure used to render the place picker. These tests drive the route,
 * not the templates alone, because the defect was the branch and not the copy:
 * a 429, an unreadable answer, and a place the file does not carry all reached
 * the same page. Each test asserts its own sentence and the absence of the other
 * five.
 */

import test, { after, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ServerResponse } from "node:http";
import { resetModelState } from "../server/lib/model.ts";

const DB = path.join(import.meta.dirname, "..", "data", "econpulse.db");
const skip = existsSync(DB) ? false : "data/econpulse.db is not present";
const askRoute = skip ? null : (await import("../server/routes/ask.ts")).routeAsk;

/**
 * What each state says. The answered state is the card, so its distinguishing
 * line is the place it answered for; a successful answer has no apology.
 */
const SAYS = {
  answered: "Cook County, Illinois",
  "need place": "I can answer that with median gross rent, but I need a place.",
  "need measure": "I found Texas. Pick a measure, or open the full report.",
  busy: "The model that reads questions is unavailable right now.",
  unreadable: "I could not read that answer.",
  "no match": "We do not know that place.",
} as const;

type State = keyof typeof SAYS;

interface Page {
  code: number;
  headers: Record<string, string>;
  body: string;
}

function stubResponse() {
  const record: Page = { code: 0, headers: {}, body: "" };
  const res = {
    writeHead(code: number, headers: Record<string, string>) {
      record.code = code;
      record.headers = headers;
      return res;
    },
    end(body?: string) {
      record.body = body ?? "";
      return res;
    },
  };
  return { res: res as unknown as ServerResponse, record };
}

async function ask(query: string): Promise<Page> {
  const { res, record } = stubResponse();
  const handled = await askRoute!(new URL(`http://127.0.0.1/ask?q=${encodeURIComponent(query)}`), res);
  assert.equal(handled, true);
  assert.ok(record.body.startsWith("<!doctype html>"), "the state rendered a page");
  assert.ok(!record.body.includes("Something broke"), "the state fell through to the error page");
  return record;
}

/** Assert this state's sentence, and that no other state's sentence is here. */
function assertSays(state: State, body: string): void {
  for (const [other, sentence] of Object.entries(SAYS) as Array<[State, string]>) {
    if (other === state) assert.ok(body.includes(sentence), `${state} page does not say "${sentence}"`);
    else assert.ok(!body.includes(sentence), `${state} page repeats the ${other} sentence: "${sentence}"`);
  }
  assert.match(body, /class="chip"/, `${state} page offers no way forward`);
}

function stubFetch(handler: () => Response): void {
  globalThis.fetch = (async () => handler()) as typeof fetch;
}

const realFetch = globalThis.fetch;
const realKey = process.env.OPENROUTER_API_KEY;

beforeEach(() => {
  resetModelState();
  delete process.env.OPENROUTER_API_KEY;
  globalThis.fetch = realFetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

after(() => {
  if (realKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = realKey;
});

test("answered — the card carries the number", { skip }, async () => {
  const page = await ask("Rent in Cook County");
  assert.equal(page.code, 200);
  assert.match(page.body, /class="grid"/, "the card renders a panel");
  assertSays("answered", page.body);
});

test("need place — a measure without a place", { skip }, async () => {
  const page = await ask("Is rent going up in Austin");
  assert.equal(page.code, 404);
  assertSays("need place", page.body);
});

test("need measure — a place without a measure", { skip }, async () => {
  const page = await ask("Federal money in Texas");
  assert.equal(page.code, 200);
  assertSays("need measure", page.body);
});

test("busy — the model returned 5xx", { skip }, async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  stubFetch(() => new Response("{}", { status: 500 }));
  const page = await ask("Is rent going up in Austin");
  assert.equal(page.code, 503);
  assertSays("busy", page.body);
});

test("unreadable — the model answered with nothing", { skip }, async () => {
  process.env.OPENROUTER_API_KEY = "test-key";
  stubFetch(() => new Response(JSON.stringify({
    model: "test",
    choices: [{ message: { content: "I cannot answer that." } }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  const page = await ask("Is rent going up in Austin");
  assert.equal(page.code, 502);
  assertSays("unreadable", page.body);
});

test("no match — the index misses and there is no model", { skip }, async () => {
  const page = await ask("Narnia");
  assert.equal(page.code, 404);
  assertSays("no match", page.body);
});
