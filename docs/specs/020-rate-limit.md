# #20 — Rate limit on the question endpoint

Parent: #3 · Epic spec: [03-the-question-box](../remediation/specs/03-the-question-box.md) · Status: draft

## Problem

One key, one public URL, no ceiling. A script can burn the daily allowance in a
minute. The old app had Redis; Redis is out of scope by decision and a limit is
still needed.

## Approach

An in-memory token bucket per client IP, plus a global ceiling:

- 20 questions per hour per IP
- 60 questions per minute overall

No dependency, no Redis, one `Map` with periodic eviction. State is lost on
restart, which is acceptable for an abuse guard rather than a quota.

On limit: HTTP 429, an HTML page naming the limit and the reset time, and a
`Retry-After` header. Never a stack trace.

The limit covers `/ask` and `/api/ask` only. Place pages and `/p/:geoid` stay
unlimited, because those are the product.

## Acceptance criteria

- [ ] The 21st question from one IP in an hour returns 429
- [ ] The page names the limit and when it resets
- [ ] `Retry-After` is set correctly
- [ ] Place pages are unaffected at any volume
- [ ] The limits are environment variables

## Risks

A shared NAT punishes an office. 20 an hour is generous for a person; the value is
configurable and documented.

## Out of scope

Persistent quotas, accounts, per-key limits, a dashboard.

## Files

new `server/lib/ratelimit.ts` · `server/routes/ask.ts` · new `tests/ratelimit.test.ts`