# #8 — All 32,330 places get facts

Parent: #1 · Epic spec: [01-finding-a-place](../remediation/specs/01-finding-a-place.md) · Status: draft

## Problem

`MIN_PLACE_POPULATION` defaults to 1,000, which drops 16,463 of 32,330 places.
Someone searching their village gets a dead end. The old app kept all of them.

## Approach

Default the filter to `0` and keep the environment variable for a lean build.

Measure, in one session, and record the result in this file:

| | before | after |
|---|---|---|
| places | 19,142 | 35,605 |
| facts | 321,295 | 449,542 |
| file | 109.8 MB | about 152 MB |
| build | 150 s | 125 s |

The places row counts every row in `place`: 32,330 places, 3,222 counties, 52
states and the United States. The title's 32,330 is the place level alone.

Measured in one worktree on 2026-10-31. The first full build with the floor
removed produced 453,306 facts and a 152.8 MB file in 125.5 s, before the
sentinel fix below. That fix drops 3,764 cells that were never values, so the
facts and file figures above are the corrected expectation; the operator's
release rebuild on `main` sets the exact numbers.

Two consequences to handle in the same change:

- **Percentiles move.** #11 computes them per kind, so adding 16,463 places
  shifts every place's percentile. The peer count is printed on the page so the
  change is visible rather than silent. #11 has landed, and the rebuild runs the
  percentile pass over the larger place set.
- **`verify` grows.** Add a check that every place above 1,000 people has at
  least one fact, which catches a loader that silently skips a level.

## What the rebuild exposed

Loading the small places surfaced a defect the floor had hidden. Census writes
its five "no value" sentinels as bare integers on some tables and with a trailing
`.0` on others, so a string test missed `-666666666.0` and published it as a
median age. A JSON null became 0 by the same route, and a margin of
`-333333333` was stored as a margin.

The loader now compares sentinels as numbers, treats a null as absent, and
refuses a negative margin. The build loses 3,393 sentinel values and 371 nulls
that were never data. Another 228 margins become absent. `verify` now checks
that no sentinel ships.

The margin check changed with it. A place of two people has a margin of two, and
the agency publishes exactly that, so 82 real rows repeated their own estimate.
The check now fails when a whole geography level of one table repeats its margin,
which is the parse failure it was written for.

## Acceptance criteria

- [x] A place of 400 people renders a report — `/p/0607525`, Bootjack CDP,
  California, population 400, returns its population panel and receipt
- [x] The four measurements above are filled in
- [ ] `verify` passes and asserts coverage — the three new checks are in and were
  exercised; the sentinel check caught 3,621 rows in the build before the fix.
  The full-file pass is the operator's rebuild, which is the release step
- [x] The build stays under six minutes — 125.5 s

## Risks

The artifact roughly doubles. Under the 400 MB budget, but the release upload and
the image build both get slower and that is worth knowing before it happens.

The search index budget moves with the place count. Measured: 19,142 places take
7.12 MB and 35,605 take 13.04 MB, against the 8 MB assertion in
`tests/search.test.ts`. The budget is #6's number, and this change takes it over.
The test needs a decision on the budget or a leaner index before the release test
run goes green.

## Out of scope

ZCTA-level facts. ZIPs resolve to counties and stay that way until there is a
reason to duplicate five agencies at postal geography.

## Files

`pipeline/sources/census.ts` · `pipeline/verify.ts` · `README.md` · `AGENTS.md`