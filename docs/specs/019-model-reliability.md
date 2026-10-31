# #19 — Model reliability: list, retry, breaker, cache

Parent: #3 · Epic spec: [03-the-question-box](../remediation/specs/03-the-question-box.md) · Status: draft

## Problem

One router id behind one key. During testing, three of six questions returned 429
on a single run. A failure today shows the place picker, which reads as "I did not
understand you" rather than "the network is busy".

## Approach

Four mechanisms, each small:

1. **A model list.** `ECONPULSE_MODEL` accepts comma-separated ids. Default
   `openrouter/free`. OpenRouter's `models` array is passed through so it fails
   over server-side.
2. **One retry** on 429, 5xx or timeout, with a 500 ms pause.
3. **A circuit breaker.** Three consecutive failures open it for 60 seconds; the
   box answers from the grammar and says the model is unavailable rather than
   pretending not to understand.
4. **A cache** keyed `(question_norm, data_version)`, one hour, in memory.

Every outcome is logged once, with the model id and the status, so the failure
rate is visible in `docker logs` without an analytics service.

## Acceptance criteria

- [ ] A failing model falls through to the next id in the list
- [ ] Three failures open the breaker for 60 s and the next question skips the call
- [ ] The same question twice makes one call
- [ ] A 429 and a parse failure produce different user-visible states
- [ ] Each failure logs model id and status once

## Risks

The breaker can stay open through a transient blip and degrade answers. 60 seconds
is short enough that a person retrying sees the model again.

## Out of scope

Streaming, token-level retries, per-user model choice, spend caps.

## Files

`server/lib/model.ts` · `server/routes/ask.ts` · new `tests/model.test.ts`