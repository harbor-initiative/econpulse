# #12 — AI summary grounded in the pillars

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) · Status: draft

## Problem

The score says 62. A reader needs the sentence that explains it, and writing that
sentence by hand for 51,158 places is not possible.

## Approach

One call to the pinned model, one per place, cached.

Input, and nothing else: place name, the five pillar scores, the three strongest
and three weakest metrics with their percentiles and the national comparison.

Contract, enforced in the prompt and validated after:

- two sentences maximum
- **no digits** — the numbers are above, the sentence says what they mean
- no advice, no prediction, no "we recommend", "consider", "should"
- fails validation → the template renders instead

Template fallback, so the page is never empty:

> Unemployment is above the national rate. Rent is below it.

Cache key `(geoid, data_version)`, in memory, one hour. A rebuild invalidates by
changing the version.

## Acceptance criteria

- [ ] Output contains no digit, asserted in code
- [ ] Advice language is rejected and falls back
- [ ] The second render of a place makes no model call
- [ ] A model failure renders the template, never an empty block
- [ ] The summary never names a measure that is absent from the page

## Risks

A grounded-looking sentence that misstates a comparison is worse than no
sentence. The validation is deliberately crude — digits and advice words — because
a subtler check would still miss the failure that matters.

## Out of scope

Per-metric commentary, generated comparisons, multi-paragraph narrative.

## Files

new `server/lib/summary.ts` · `server/views/header.ts` · `server/routes/place.ts` · new `tests/summary.test.ts`