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

### What changed while building it

**Two thresholds, answering different questions.** The job speaks up at 45 days;
a page warns a reader at 120, from `lib/freshness.ts`. A monitor should be
noisier than the page, because the person who reads the job can still fix the
file. `scripts/data-age.mjs` reports both numbers so the difference is visible
rather than surprising.

**The script never fails on old data.** It exits non-zero only when the file
cannot be read. A job that goes red because the data is old reports a broken job
instead of an old file, and gets muted.

**The issue body carries the fix**, not just the complaint: the three commands
that swap the file and restart the container, which #27 made possible.

## Risks

A noisy job gets muted. One comment a week on one issue is the loudest this
should ever be.

## Out of scope

Auto-rebuilding the data, paging anyone, Slack.

## Files

new `.github/workflows/staleness.yml` · new `scripts/data-age.mjs`