# #13 — Freshness signal per panel

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) · Status: draft

## Problem

Every fact carries `retrieved_at` and the page never shows it above 10px mono.
A reader cannot tell whether a number is from last week or last quarter, and a
citation with a two-month-old figure is worse than no citation because it looks
current.

## Approach

Three bands, computed from `retrieved_at` at render:

| band | age | treatment |
|---|---|---|
| fresh | < 35 days | nothing rendered |
| aging | 35–120 days | the date in the panel receipt, in `--receipt` |
| stale | > 120 days | an amber strip above the panel naming the source and the age |

The header block carries the newest and oldest fact dates, once, in mono.

The thresholds are constants in one module, imported by the page and by
`/healthz` (#24), so the page and the monitor cannot disagree.

## Acceptance criteria

- [ ] A panel over 120 days shows the amber strip with source and age
- [ ] A panel between 35 and 120 days shows its date in the receipt
- [ ] A fresh panel shows nothing
- [ ] Header shows newest and oldest fact dates
- [ ] Thresholds come from one module, asserted in a test

## Risks

Staleness is a property of the file, not of the request. A page with one stale
source should not look entirely stale, which is why the strip is per panel.

## Out of scope

Per-fact ages, revision history, a public changelog of revisions.

## Files

new `server/freshness.ts` · `server/view.ts` · `server/index.ts` ·
new `tests/freshness.test.ts`
