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

The header block carries the newest and oldest fact dates, once, in mono:
`pulled 2026-05-01 to 2026-10-30`, or `pulled 2026-10-31` when the file was
refreshed in one pass.

The thresholds are constants in one module, imported by the page and by
`/healthz` (#24), so the page and the monitor cannot disagree.

### What changed while building it

Three things, recorded because the spec said otherwise.

1. **Aging prints the age.** The spec said the aging band shows "the date in the
   panel receipt". The receipt already prints the date for a fresh panel, so the
   aging band was invisible and the three bands collapsed to two. An aging
   receipt now ends `· 77 days old`. The fresh receipt is unchanged.
2. **The header line lives in `views/report.ts`.** `views/header.ts` does not exist
   yet; #10 creates it and will move this line into it. Building a second header
   module here would have given #10 two places to reconcile.
3. **`/healthz` gained five fields**, not a new endpoint: `oldest`, `newest`,
   `ageDays`, `band`, `staleAfterDays`. A monitor needs the thresholds it is being
   measured against, and putting them in the module is what stops the page and the
   monitor drifting.

## Acceptance criteria

- [ ] A panel over 120 days shows the amber strip with source and age
- [ ] A panel between 35 and 120 days shows its date in the receipt
- [ ] A fresh panel shows nothing
- [ ] Header shows newest and oldest fact dates
- [ ] Thresholds come from one module, asserted in a test

## Risks

Staleness describes the file. A page with one stale
source should not look entirely stale, which is why the strip is per panel.

## Out of scope

Per-fact ages, revision history, a public changelog of revisions.

## Files

new `server/lib/freshness.ts` · `server/views/panel.ts` · `server/views/report.ts` · `server/views/css.ts` · `server/routes/place.ts` · `server/routes/ask.ts` · `server/routes/status.ts` · new `tests/freshness.test.ts`