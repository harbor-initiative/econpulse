# Spec 3 — The question box

Status: draft · Owner: unassigned · Depends on: Spec 1 (place index)
Decision source: interview 2026-10-30, decision 3.

## Problem

The box exists and answers questions, and it has no states. What shipped today:

- A question is routed to the model, the model names a place and a measure, the
  index resolves the name. This part works.
- Every failure looks the same: the place picker. "I could not reach the model"
  and "I did not understand you" are the same screen.
- There is no loading state. The request blocks for three to five seconds and
  the browser shows nothing.
- There is no rate limit. One key, one public URL, no ceiling.
- The model list is a single router id. Three of six test questions returned 429
  on one run.
- Comparison questions ("Austin vs Nashville") are not supported at all, and the
  old app had a whole `/compare` page for them.

## Decision

- The model leads. The grammar is a fallback for names only.
- The model never sees or returns a GEOID.
- Every failure has its own state and its own sentence.

## Design

### 1. Routing

```
input
 ├─ 5 digits ─────────────────────────► ZIP → county (done)
 ├─ question mark | question word | >5 words ─► model → index
 └─ otherwise ────────────────────────► index only
        └─ index miss, and a key exists ─► model → index
```

`isQuestion` in `server/ask.ts` already implements the middle branch.

### 2. The model contract

Request: the question plus the metric menu. Response: `{place, metric}` where
`place` is a plain name and `metric` is an id from the menu.

Validation, in order:

1. Extract the first balanced JSON object. A greedy regex spans two of them.
2. `metric` must exist in the menu, or it is dropped.
3. `place` is resolved through the index. An unresolvable name means no place.
4. If both are null, the state is **not understood**, not **unavailable**.

### 3. Fallbacks

- **Model list, not one id.** `ECONPULSE_MODEL` may be a comma-separated list.
  Default: `openrouter/free`.
- **One retry** on 429, 5xx or timeout.
- **Circuit breaker.** After three consecutive failures, skip the model for 60
  seconds and answer from the grammar. Prevents five-second waits on a dead
  provider.
- **Cache.** `(question_norm, data_version)` to rendered answer, in memory, one
  hour. The same question twice costs nothing.

### 4. Rate limit

An in-memory token bucket per client IP: 20 questions per hour, 60 requests per
minute overall. No Redis, no dependency.

On limit: HTTP 429 with a page that says the limit and when it resets. Never a
stack trace, never a blank.

The limit applies to `/ask` and `/api/ask` only. Place pages and `/p/:geoid` stay
unlimited.

### 5. States

| State | What happened | What the page says |
|---|---|---|
| Loading | request in flight | shell with the question echoed and a progress line: *reading the question · finding the place · pulling the number* |
| Not understood | no place and no metric resolved | "I could not tell which place you meant." + picker + examples |
| Model unavailable | breaker open or both attempts failed | "The model is not responding right now. Pick a place and I will answer without it." |
| Place not found | a name was returned but the index missed | "I found *X* but we do not have it." + nearest matches |
| Measure missing | place resolved, metric absent | "No *measure* for *place*." + the measures it does have |
| Rate limited | bucket empty | "20 questions an hour. Resets at *time*." |

Each is a distinct template. None of them is an error page.

### 6. Loading without blocking

Progressive enhancement with no framework:

- The form posts normally. With JavaScript, it is intercepted: `fetch` the same
  URL, show the shell immediately, then replace the document with the response.
- The progress line advances on a timer and the last step
  waits for the response. It never claims to be finished early.
- With JavaScript off, the original blocking request still works.

### 7. Comparison

"Philadelphia vs Chester", "compare Austin and Nashville".

- The model returns `{"place":"Austin","metric":null,"compareTo":"Nashville"}`.
- Both names resolve through the index.
- The result is a two-series panel per shared metric, plus a score comparison.

This is the one new capability in this spec. It replaces the old `/compare` page
and it is deferred to v2 of this spec if the first pass runs long.

## Acceptance criteria

1. A question with no key shows the model-unavailable state.
2. A question the model cannot place shows the not-understood state.
3. Killing the model mid-flight produces the unavailable state within 6 s.
4. The 21st question from one IP in an hour returns 429 with a reset time.
5. The same question twice does not call the model twice.
6. With JavaScript disabled the box still answers.
7. "Austin vs Nashville" renders two series for every shared metric.
8. Every state is reachable in a test, with a fixture.

## Risks

- **Free-tier latency is variable.** Three to five seconds is normal, ten is
  possible. The loading state is what makes that tolerable.
- **Rate limiting by IP punishes shared networks.** 20 an hour is generous for a
  person and small for an office behind one NAT. Accepted for a single box; the
  limit is an env var.
- **Comparison doubles the query cost.** Two place lookups and two series. Kept
  out of the default path.

## Out of scope

Conversation memory across turns, follow-up questions that refer to a previous
answer, saved questions, and any streaming of the model's tokens.

## Files touched

`server/ask.ts`, `server/index.ts`, `server/view.ts`, new `server/ratelimit.ts`,
new `server/states.ts`, new `public/ask.js`, new `tests/ask.test.ts`.
