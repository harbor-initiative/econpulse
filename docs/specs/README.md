# Specifications, one per issue

Every open issue has its own specification here, committed and pushed to `main`
before the issue pointed at it. An issue without a file below is not ready to
build.

The five epics are specified by the cluster documents in
[`../remediation/specs/`](../remediation/specs/); their children carry their own
file.

| Issue | Title | Priority | Specification |
|---|---|---|---|
| **#1** | **Finding a place** | **P0** | [epic](../remediation/specs/01-finding-a-place.md) |
| #5 | Alias table | P0 | [005-alias-table.md](005-alias-table.md) |
| #6 | Fuzzy search index | P0 | [006-fuzzy-index.md](006-fuzzy-index.md) |
| #7 | Autocomplete | P0 | [007-autocomplete.md](007-autocomplete.md) |
| #8 | Full place coverage | P0 | [008-coverage.md](008-coverage.md) |
| #9 | Use my location | P2 | [009-location.md](009-location.md) |
| **#2** | **The report** | **P0** | [epic](../remediation/specs/02-the-report.md) |
| #10 | Header block | P0 | [010-header-block.md](010-header-block.md) |
| #11 | Percentiles | P1 | [011-percentiles.md](011-percentiles.md) |
| #12 | AI summary | P0 | [012-ai-summary.md](012-ai-summary.md) |
| #13 | Freshness | P0 | [013-freshness.md](013-freshness.md) |
| #14 | Benchmarks | P1 | [014-benchmarks.md](014-benchmarks.md) |
| #15 | Quick facts | P2 | [015-quick-facts.md](015-quick-facts.md) |
| #16 | Map | P1 | [016-map.md](016-map.md) |
| #17 | Print | P1 | [017-print.md](017-print.md) |
| #18 | Chart tables | P1 | [018-chart-tables.md](018-chart-tables.md) |
| **#36** | **The factory** | **P0** | [../FACTORY.md](../FACTORY.md) |
| **#35** | **Server split** | **P0** | [035-server-split.md](035-server-split.md) |
| **#34** | **Design clean-up** | **P1** | [epic](../remediation/specs/05-design-system.md) |
| #37 | The measurement gate | P1 | [037-design-gate.md](037-design-gate.md) |
| #49 | Cache only a success | P0 | [049-cache-safety.md](049-cache-safety.md) |
| #58 | The gates wait on a port, not a mood | P1 | [058-gate-readiness.md](058-gate-readiness.md) |
| #69 | Typing a city name returns its county | P0 | [069-city-before-county.md](069-city-before-county.md) |
| #29 | Panel substance | P1 | [029-panel-substance.md](029-panel-substance.md) |
| #30 | Legends | P1 | [030-legends.md](030-legends.md) |
| #31 | Docked search | P1 | [031-docked-search.md](031-docked-search.md) |
| #32 | Meaning without colour | P1 | [032-meaning-without-colour.md](032-meaning-without-colour.md) |
| #33 | Typefaces | P1 | [033-typefaces.md](033-typefaces.md) |
| **#3** | **The question box** | **P0** | [epic](../remediation/specs/03-the-question-box.md) |
| #19 | Model reliability | P0 | [019-model-reliability.md](019-model-reliability.md) |
| #20 | Rate limit | P1 | [020-rate-limit.md](020-rate-limit.md) |
| #21 | Six states | P0 | [021-states.md](021-states.md) |
| #22 | Progressive loading | P1 | [022-progressive-loading.md](022-progressive-loading.md) |
| #23 | Comparison | P1 | [023-comparison.md](023-comparison.md) |
| **#4** | **Trust and reach** | **P1** | [epic](../remediation/specs/04-trust-and-reach.md) |
| #24 | Health and status | P1 | [024-health-status.md](024-health-status.md) |
| #25 | Method page | P2 | [025-method.md](025-method.md) |
| #26 | Discoverability | P1 | [026-discoverability.md](026-discoverability.md) |
| #27 | Refresh without rebuild | P2 | [027-refresh.md](027-refresh.md) |
| #28 | Staleness job | P2 | [028-staleness-job.md](028-staleness-job.md) |

## The rule

A specification is committed and pushed before the issue references it, and the
issue links to the file on `main` rather than a branch, so the link resolves for
anyone who opens it.

## What a specification holds

Problem, approach, acceptance criteria, risks, out of scope, and the files it
touches. The acceptance criteria are mirrored into the issue as checkboxes so
progress is visible without opening the file.
