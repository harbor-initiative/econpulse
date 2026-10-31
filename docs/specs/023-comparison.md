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

### What changed while building it

**The obvious comparison does not need a model.** `Austin vs Nashville` is two
names around a keyword, so `parseComparison` splits it, resolves both through the
index, and answers with no key, no network and no quota. The model still handles
"how does Austin compare with Nashville on rent"; the grammar handles the shape
everybody types.

**A single period each is two bars, not a line.** Population, rent, home value,
income and poverty have one period in this file. A line through one point is not
a chart, so those measures render as two scaled bars with both values printed.

**The delta had to be formatted per unit.** The first render said
`+8577461000.0 above Davidson County, Tennessee` next to `+$85.8B` in the same
panel. A gap in dollars is not a gap in points.

**One name resolving is better than none.** If one of the two places is not in
the file, the page answers about the one that is and says which name it dropped.
The first version refused the whole question.

## Risks

The model may return a second place for a question that was not a comparison.
Validation requires an explicit comparison trigger in the question before the
field is used.

## Out of scope

Three or more places, saving a comparison, sharing a comparison URL.

## Files

`server/routes/ask.ts` · `server/ask.ts` · `server/views/ask.ts` · new `tests/compare.test.ts`