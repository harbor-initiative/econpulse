# #23 — Comparison questions: “Austin vs Nashville”

Parent: #3 · Epic spec: [03-the-question-box](../remediation/specs/03-the-question-box.md) · Status: draft

## Problem

The old app had a `/compare` page and a peer suggester. The rebuild cannot compare
two places at all, and it is one of the most natural questions about a place.

## Approach

The model already returns a place name. Extend the contract with an optional
third field:

```json
{"place": "Austin", "metric": null, "compareTo": "Nashville"}
```

Both names resolve through the index (#6). The result renders one panel per shared
metric, two series, a legend, and a score comparison in the header block.

Trigger phrases: "vs", "versus", "compared to", "compare X and Y". The model
handles the rest; the grammar only needs to route comparison-shaped input to it.

If the second name does not resolve, the page degrades to the single place and
says which one it dropped.

## Acceptance criteria

- [ ] "Austin vs Nashville" renders two series for every shared metric
- [ ] The header shows both scores
- [ ] An unresolvable second place degrades to one, naming the drop
- [ ] Two places with no metrics in common renders a clear empty state
- [ ] The query cost is bounded: two place lookups, no extra model call

## Risks

The model may return a second place for a question that was not a comparison.
Validation requires an explicit comparison trigger in the question before the
field is used.

## Out of scope

Three or more places, saving a comparison, sharing a comparison URL.

## Files

`server/ask.ts` · `server/index.ts` · `server/view.ts` ·
new `tests/compare.test.ts`
