# #25 — Method page

Parent: #4 · Epic spec: [04-trust-and-reach](../remediation/specs/04-trust-and-reach.md) · Status: draft

## Problem

Nowhere on the site explains where the numbers come from, why ACS and BLS
disagree, or how the score is built. "Why should I trust this" has no answer,
which is fatal for a product whose only claim is provenance.

## Approach

`/method`, linked from the score and the footer. Five sections:

1. **The five agencies**, one line each: what it measures, how often, at what
   geography.
2. **Why two unemployment rates.** ACS is a five-year average; BLS is a monthly
   estimate. They disagree by design and the page says why.
3. **How the score is built.** The percentile method from #11, the weights, the
   renormalisation when a pillar is missing.
4. **What the score is not.** Not a prediction, not advice, not a judgement of a
   place or the people in it.
5. **How to cite it.** App version, data version, retrieval date, the exact string.

## Acceptance criteria

- [ ] Linked from the header block and the footer
- [ ] States the weights and they match the code
- [ ] Gives a copyable citation string
- [ ] Names every agency in the file
- [ ] Reads at a general-audience level, no jargon without a gloss

## Risks

A method page drifts from the code. The weights are imported from the same module
the score uses, so a change breaks the page or the tests.

## Out of scope

An academic methodology paper, per-metric documentation pages.

## Files

new `server/method.ts` · `server/index.ts` · `server/view.ts`
