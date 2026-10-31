# Specifications, one per issue

Every open issue has its own specification in this directory, committed and
pushed to `main` before the issue was updated to point at it. An issue without a
spec here is not ready to build.

Epics (`#1`–`#4`) are specified by the cluster documents in
[`../remediation/specs/`](../remediation/specs/). Feature issues carry their own
file below.

| Issue | Title | Parent | Priority | Specification |
|---|---|---|---|---|
| **#1** | **Finding a place** | — | **P0** | [epic spec](../remediation/specs/01-finding-a-place.md) |
| #5 | Alias table | #1 | P0 | [005-alias-table.md](005-alias-table.md) |
| #6 | Fuzzy search index | #1 | P0 | [006-fuzzy-index.md](006-fuzzy-index.md) |
| #7 | Autocomplete | #1 | P0 | [007-autocomplete.md](007-autocomplete.md) |
| #8 | Full place coverage | #1 | P0 | [008-coverage.md](008-coverage.md) |
| #9 | Use my location | #1 | P2 | [009-location.md](009-location.md) |
| **#2** | **The report** | — | **P0** | [epic spec](../remediation/specs/02-the-report.md) |
| #10 | Header block | #2 | P0 | [010-header-block.md](010-header-block.md) |
| #11 | Percentiles | #2 | P1 | [011-percentiles.md](011-percentiles.md) |
| #12 | AI summary | #2 | P0 | [012-ai-summary.md](012-ai-summary.md) |
| #13 | Freshness | #2 | P0 | [013-freshness.md](013-freshness.md) |
| #14 | Benchmarks | #2 | P1 | [014-benchmarks.md](014-benchmarks.md) |
| #15 | Quick facts | #2 | P2 | [015-quick-facts.md](015-quick-facts.md) |
| #16 | Map | #2 | P1 | [016-map.md](016-map.md) |
| #17 | Print | #2 | P1 | [017-print.md](017-print.md) |
| #18 | Chart tables | #2 | P1 | [018-chart-tables.md](018-chart-tables.md) |
| #29 | Panel substance | #2 | P1 | [029-panel-substance.md](029-panel-substance.md) |
| #30 | Legends | #2 | P1 | [030-legends.md](030-legends.md) |
| #31 | Docked search | #2 | P1 | [031-docked-search.md](031-docked-search.md) |
| #32 | Meaning without colour | #2 | P1 | [032-meaning-without-colour.md](032-meaning-without-colour.md) |
| #33 | Typefaces | #2 | P1 | [033-typefaces.md](033-typefaces.md) |
| **#3** | **The question box** | — | **P0** | [epic spec](../remediation/specs/03-the-question-box.md) |
| #19 | Model reliability | #3 | P0 | [019-model-reliability.md](019-model-reliability.md) |
| #20 | Rate limit | #3 | P1 | [020-rate-limit.md](020-rate-limit.md) |
| #21 | Six states | #3 | P0 | [021-states.md](021-states.md) |
| #22 | Progressive loading | #3 | P1 | [022-progressive-loading.md](022-progressive-loading.md) |
| #23 | Comparison | #3 | P1 | [023-comparison.md](023-comparison.md) |
| **#4** | **Trust and reach** | — | **P1** | [epic spec](../remediation/specs/04-trust-and-reach.md) |
| #24 | Health and status | #4 | P1 | [024-health-status.md](024-health-status.md) |
| #25 | Method page | #4 | P2 | [025-method.md](025-method.md) |
| #26 | Discoverability | #4 | P1 | [026-discoverability.md](026-discoverability.md) |
| #27 | Refresh without rebuild | #4 | P2 | [027-refresh.md](027-refresh.md) |
| #28 | Staleness job | #4 | P2 | [028-staleness-job.md](028-staleness-job.md) |

## The rule

A specification is committed and pushed before its issue references it. The
issue body links to the file on `main`, not to a branch, so the link resolves for
anyone who opens it.

## What a specification contains

Problem, approach, acceptance criteria, risks, out of scope, and the files it
touches. The acceptance criteria are copied into the issue as checkboxes so
progress is visible without opening the file.
