# #11 — Percentile column computed at build time

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) · Status: draft

## Problem

The old score was invented: `scoreAffordability = 100 - rentBurden * 140`. Nobody
can check it, and it does not survive a change of vintage. Restoring the score
means restoring a number someone can audit.

## Approach

A percentile against peers, computed at build and stored on the fact row.

```sql
ALTER TABLE fact ADD COLUMN percentile REAL;
```

For each metric, within its own `kind` (counties against counties, places against
places), compute the value's percentile. Direction comes from `metric.direction`:

- `higher_is_better` → the percentile as is
- `lower_is_better` → `100 − percentile`
- `neutral` → excluded from scoring, still displayed

The peer count is stored in `build` and printed on the page, so a reader knows
what "62nd percentile" is measured against.

Pillar and overall weights live in `/method` and in code, in one place, so they
cannot diverge.

## Acceptance criteria

- [ ] `percentile` is populated for every scored metric
- [ ] An independent recomputation in a test matches the stored value
- [ ] Neutral metrics carry no percentile and are not scored
- [ ] The peer count renders on the page
- [ ] A metric present for fewer than 100 peers is not scored

## Risks

The peer set changes when #8 lands, moving every percentile. That is why the
count is printed. A place with no peers for a metric drops that metric and
renormalises, which must be visible.

## Out of scope

Time series of percentile, national ranking tables, comparisons across kinds.

## Files

`pipeline/schema.sql` · new `pipeline/percentile.ts` · `pipeline/build.ts` ·
`pipeline/verify.ts` · new `tests/percentile.test.ts`
