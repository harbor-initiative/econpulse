# #28 — Staleness job that opens an issue

Parent: #4 · Epic spec: [04-trust-and-reach](../remediation/specs/04-trust-and-reach.md) · Status: draft

## Problem

Nothing fails when the data ages. A product about provenance that quietly serves
a two-month-old file is the exact failure it claims to prevent.

## Approach

A weekly GitHub Action, Monday 09:00 UTC:

1. Read `build.finished_at` from the released database.
2. If older than 45 days, open an issue titled `Data is N days old`.
3. If an open staleness issue exists, comment the new count instead of opening a
   second.

The workflow needs only `contents: read` and `issues: write`.

## Acceptance criteria

- [ ] A 46-day-old build opens an issue naming the age
- [ ] A fresh build opens nothing
- [ ] A second week comments on the existing issue rather than duplicating
- [ ] Closing the issue and running again re-opens it

## Risks

A noisy job gets muted. One comment a week on one issue is the loudest this
should ever be.

## Out of scope

Auto-rebuilding the data, paging anyone, Slack.

## Files

new `.github/workflows/staleness.yml` · `scripts/data-age.mjs`
