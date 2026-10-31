/**
 * The four guards on the model call: the list, the retry, the breaker, the cache.
 *
 * The network is stubbed and the clock is injected, so these tests are about
 * this process's decisions and not about OpenRouter's mood. Two things matter
 * beyond the obvious: that one failure logs one line, and that a 429 and an
 * unreadable answer leave the reader on different pages.
 */

import test, { after, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { askModel, isModelUnavailable, resetModelState, type ModelContext } from "../server/lib/model.ts";
import { parseQuestion } from "../server/ask.ts";
import { askModelBusy, askNeedPlace } from "../server/views/states.ts";

const METRICS = [
  { id: "population", label: "Population" },
  { id: "median_gross_rent", label: "Median gross rent" },
];
const ANSWER = '{"place":"Austin","metric":"median_gross_rent"}';

const realFetch = globalThis.fetch;
const realLog = console.log;
const realError = console.error;
const saved = {
  key: process.env.OPENROUTER_API_KEY,
  model: process.env.ECONPULSE_MODEL,
  alt: process.env.OPENROUTER_MODEL,
};

let calls: Array<Record<string, unknown>> = [];
let logs: string[] = [];
let errors: string[] = [];
let sleeps: number[] = [];
const clock = { t: 1_000_000 };

function context(overrides: Partial<ModelContext> = {}): ModelContext {
  return {
    dataVersion: "2026.10",
    now: () => clock.t,
    sleep: async (ms: number) => { sleeps.push(ms); },
    ...overrides,
  };
}

function stubFetch(handler: (index: number) => Response | Promise<Response>): void {
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {};
    calls.push(body);
    return handler(calls.length - 1);
  }) as typeof fetch;
}

function answered(content: string, used = "openrouter/free"): Response {
  return new Response(JSON.stringify({ model: used, choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function failed(code: number): Response {
  return new Response("{}", { status: code, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  resetModelState();
  calls = [];
  logs = [];
  errors = [];
  sleeps = [];
  clock.t = 1_000_000;
  process.env.OPENROUTER_API_KEY = "test-key";
  delete process.env.ECONPULSE_MODEL;
  delete process.env.OPENROUTER_MODEL;
  console.log = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(" ")); };
});

afterEach(() => {
  console.log = realLog;
  console.error = realError;
  globalThis.fetch = realFetch;
});

after(() => {
  if (saved.key === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = saved.key;
  if (saved.model === undefined) delete process.env.ECONPULSE_MODEL;
  else process.env.ECONPULSE_MODEL = saved.model;
  if (saved.alt === undefined) delete process.env.OPENROUTER_MODEL;
  else process.env.OPENROUTER_MODEL = saved.alt;
});

test("the model list travels as OpenRouter's models array, in order", async () => {
  process.env.ECONPULSE_MODEL = " openrouter/free, anthropic/claude-sonnet-4.5 ,openrouter/free ";
  stubFetch(() => answered(ANSWER));
  const outcome = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(outcome.status, "ok");
  assert.deepEqual(outcome.answer, { placeName: "Austin", metric: "median_gross_rent" });
  assert.deepEqual(calls[0]?.models, ["openrouter/free", "anthropic/claude-sonnet-4.5"]);
  assert.equal("model" in (calls[0] ?? {}), false);
});

test("the default model list is openrouter/free", async () => {
  stubFetch(() => answered(ANSWER));
  await askModel("Is rent going up in Austin?", METRICS, context());
  assert.deepEqual(calls[0]?.models, ["openrouter/free"]);
});

test("a 429 gets one retry after a 500 ms pause", async () => {
  stubFetch((index) => (index === 0 ? failed(429) : answered(ANSWER)));
  const outcome = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(outcome.status, "ok");
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [500]);
  assert.equal(logs.length, 1);
});

test("two 429s end unavailable, logged once with the model and the status", async () => {
  stubFetch(() => failed(429));
  const outcome = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(outcome.status, "unavailable");
  assert.equal(isModelUnavailable(outcome), true);
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [500]);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /model openrouter\/free status unavailable/);
  assert.match(errors[0] ?? "", /429/);
});

test("a 400 is not retried", async () => {
  stubFetch(() => failed(400));
  const outcome = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(outcome.status, "failed");
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
  assert.equal(errors.length, 1);
});

test("a timeout is retried once", async () => {
  stubFetch(() => {
    const error = new Error("aborted");
    error.name = "AbortError";
    return Promise.reject(error);
  });
  const outcome = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(outcome.status, "unavailable");
  assert.equal(calls.length, 2);
  assert.deepEqual(sleeps, [500]);
  assert.match(errors[0] ?? "", /timeout/);
});

test("an answer without JSON is unreadable, not unavailable, and is not retried", async () => {
  stubFetch(() => answered("I cannot help with that."));
  const outcome = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(outcome.status, "unreadable");
  assert.equal(isModelUnavailable(outcome), false);
  assert.equal(calls.length, 1);
  assert.deepEqual(sleeps, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /status unreadable/);
});

test("three consecutive failures open the breaker for sixty seconds", async () => {
  stubFetch(() => failed(500));
  for (const name of ["Austin", "Boston", "Chicago"]) {
    await askModel(`Is rent going up in ${name}?`, METRICS, context());
  }
  assert.equal(calls.length, 6);
  const skipped = await askModel("Is rent going up in Denver?", METRICS, context());
  assert.equal(skipped.status, "unavailable");
  assert.equal(calls.length, 6);
  assert.match(errors.at(-1) ?? "", /breaker open/);

  clock.t += 60_001;
  stubFetch(() => answered(ANSWER));
  const probe = await askModel("Is rent going up in Denver?", METRICS, context());
  assert.equal(probe.status, "ok");
  assert.equal(calls.length, 7);
});

test("a failed probe after the window reopens the breaker", async () => {
  stubFetch(() => failed(429));
  for (const name of ["Austin", "Boston", "Chicago"]) {
    await askModel(`Is rent going up in ${name}?`, METRICS, context());
  }
  clock.t += 60_001;
  const probe = await askModel("Is rent going up in Denver?", METRICS, context());
  assert.equal(probe.status, "unavailable");
  assert.equal(calls.length, 8);
  await askModel("Is rent going up in El Paso?", METRICS, context());
  assert.equal(calls.length, 8);
});

test("a success resets the failure count", async () => {
  let failing = true;
  stubFetch(() => (failing ? failed(429) : answered(ANSWER)));
  await askModel("Is rent going up in Austin?", METRICS, context());
  await askModel("Is rent going up in Boston?", METRICS, context());
  failing = false;
  assert.equal((await askModel("Is rent going up in Chicago?", METRICS, context())).status, "ok");
  failing = true;
  await askModel("Is rent going up in Denver?", METRICS, context());
  await askModel("Is rent going up in El Paso?", METRICS, context());
  failing = false;
  assert.equal((await askModel("Is rent going up in Fresno?", METRICS, context())).status, "ok");
  assert.equal(calls.length, 10);
});

test("the same question twice makes one call", async () => {
  stubFetch(() => answered(ANSWER));
  const first = await askModel("Is rent going up in Austin?", METRICS, context());
  const second = await askModel("  is   RENT going up in Austin?  ", METRICS, context());
  assert.equal(calls.length, 1);
  assert.equal(first.status, "ok");
  assert.equal(second.status, "cached");
  assert.deepEqual(second.answer, first.answer);
  assert.equal(logs.length, 2);
  assert.match(logs[1] ?? "", /status cached/);
});

test("the cache expires after an hour", async () => {
  stubFetch(() => answered(ANSWER));
  await askModel("Is rent going up in Austin?", METRICS, context());
  clock.t += 3_600_001;
  await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(calls.length, 2);
});

test("the cache key includes the data version", async () => {
  stubFetch(() => answered(ANSWER));
  await askModel("Is rent going up in Austin?", METRICS, context());
  await askModel("Is rent going up in Austin?", METRICS, context({ dataVersion: "2026.11" }));
  assert.equal(calls.length, 2);
});

test("a failed question is not cached", async () => {
  let failing = true;
  stubFetch(() => (failing ? failed(429) : answered(ANSWER)));
  assert.equal((await askModel("Is rent going up in Austin?", METRICS, context())).status, "unavailable");
  failing = false;
  assert.equal((await askModel("Is rent going up in Austin?", METRICS, context())).status, "ok");
  assert.equal(calls.length, 3);
});

test("with no key the model is off and no call is made", async () => {
  delete process.env.OPENROUTER_API_KEY;
  stubFetch(() => answered(ANSWER));
  const outcome = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(outcome.status, "off");
  assert.equal(calls.length, 0);
  assert.equal(logs.length + errors.length, 0);
});

test("a success logs the model that answered", async () => {
  stubFetch(() => answered(ANSWER, "anthropic/claude-sonnet-4.5"));
  await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(logs.length, 1);
  assert.match(logs[0] ?? "", /model openrouter\/free status ok used anthropic\/claude-sonnet-4\.5/);
});

test("a 429 and a parse failure reach different page states", async () => {
  stubFetch(() => failed(429));
  const down = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(isModelUnavailable(down), true);

  stubFetch(() => answered("I cannot answer that."));
  const unreadable = await askModel("Is rent going up in Austin?", METRICS, context());
  assert.equal(unreadable.status, "unreadable");
  assert.equal(isModelUnavailable(unreadable), false);

  const busy = askModelBusy("Is rent going up in Austin?", ["Population of Cook County"]);
  const picker = askNeedPlace("Is rent going up in Austin?", null, ["Population of Cook County"]);
  assert.notEqual(busy, picker);
  assert.match(busy, /Model unavailable/);
  assert.match(busy, /unavailable right now/);
  assert.match(picker, /I need a place/);
});

test("parseQuestion carries the model outcome to the route", async () => {
  stubFetch(() => failed(429));
  const parsed = await parseQuestion({} as DatabaseSync, "Is rent going up in Austin?", METRICS, "2026.10");
  assert.equal(parsed.place, null);
  assert.equal(parsed.metric, "median_gross_rent");
  assert.equal(parsed.model?.status, "unavailable");
  assert.equal(isModelUnavailable(parsed.model), true);

  stubFetch(() => answered("not json"));
  const unreadable = await parseQuestion({} as DatabaseSync, "Is rent going up in Boston?", METRICS, "2026.10");
  assert.equal(unreadable.model?.status, "unreadable");
  assert.equal(isModelUnavailable(unreadable.model), false);
});
