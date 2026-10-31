/**
 * The ceiling, and the clock it measures.
 *
 * Time is passed in rather than slept through, so the test says exactly what a
 * token bucket does at a boundary instead of hoping the machine is fast.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_LIMIT, GLOBAL_LIMIT, allow, clientKey, evict, reset } from "../server/lib/ratelimit.ts";

const T0 = 1_000_000_000_000;

test("a person gets their whole allowance and not one more", () => {
  reset(T0);
  for (let i = 0; i < CLIENT_LIMIT.capacity; i += 1) {
    assert.equal(allow("1.2.3.4", T0).allowed, true, `request ${i + 1}`);
  }
  const refused = allow("1.2.3.4", T0);
  assert.equal(refused.allowed, false);
  assert.equal(refused.limit, "client");
  assert.ok(refused.retryAfter > 0, "it says when to come back");
});

test("the allowance comes back over the hour", () => {
  reset(T0);
  for (let i = 0; i < CLIENT_LIMIT.capacity; i += 1) allow("1.2.3.4", T0);
  assert.equal(allow("1.2.3.4", T0).allowed, false);
  // A full window later, the bucket is full again.
  assert.equal(allow("1.2.3.4", T0 + CLIENT_LIMIT.windowMs + 1).allowed, true);
});

test("one caller cannot spend the global allowance", () => {
  reset(T0);
  // Spread the per-client allowance across enough addresses to hit the global cap.
  const needed = Math.ceil(GLOBAL_LIMIT.capacity / CLIENT_LIMIT.capacity) + 1;
  const refused = [];
  for (let client = 0; client < needed; client += 1) {
    for (let i = 0; i < CLIENT_LIMIT.capacity; i += 1) {
      const decision = allow(`10.0.0.${client}`, T0);
      if (!decision.allowed) refused.push(decision);
    }
  }
  assert.ok(refused.length > 0, "the global ceiling was reached");
  assert.equal(refused[0]?.limit, "global");
});

test("a refused global request does not cost the client a token", () => {
  reset(T0);
  const needed = Math.ceil(GLOBAL_LIMIT.capacity / CLIENT_LIMIT.capacity);
  for (let client = 0; client < needed; client += 1) {
    for (let i = 0; i < CLIENT_LIMIT.capacity; i += 1) allow(`10.1.0.${client}`, T0);
  }
  const before = allow("10.9.9.9", T0);
  assert.equal(before.allowed, false);
  assert.equal(before.limit, "global");
  // The window turns over; that client's own bucket was never touched.
  const after = allow("10.9.9.9", T0 + GLOBAL_LIMIT.windowMs + 1);
  assert.equal(after.allowed, true);
});

test("the caller is the first address in the forwarded header", () => {
  assert.equal(clientKey({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "127.0.0.1"), "203.0.113.7");
  assert.equal(clientKey({}, "127.0.0.1"), "127.0.0.1");
  assert.equal(clientKey({}, undefined), "unknown");
});

test("idle buckets are dropped", () => {
  reset(T0);
  allow("198.51.100.1", T0);
  assert.equal(evict(T0), 0, "a bucket inside the window stays");
  assert.equal(evict(T0 + CLIENT_LIMIT.windowMs + 1), 1);
});
