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
| places | 19,142 | ? |
| facts | 321,295 | ? |
| file | 109.8 MB | ? |
| build | 150 s | ? |

Two consequences to handle in the same change:

- **Percentiles move.** #11 computes them per kind, so adding 16,463 places
  shifts every place's percentile. The peer count is printed on the page so the
  change is visible rather than silent.
- **`verify` grows.** Add a check that every place above 1,000 people has at
  least one fact, which catches a loader that silently skips a level.

## Acceptance criteria

- [ ] A place of 400 people renders a report
- [ ] The four measurements above are filled in
- [ ] `verify` passes and asserts coverage
- [ ] The build stays under six minutes

## Risks

The artifact roughly doubles. Under the 400 MB budget, but the release upload and
the image build both get slower and that is worth knowing before it happens.

## Out of scope

ZCTA-level facts. ZIPs resolve to counties and stay that way until there is a
reason to duplicate five agencies at postal geography.

## Files

`pipeline/sources/census.ts` · `pipeline/verify.ts` · `README.md`