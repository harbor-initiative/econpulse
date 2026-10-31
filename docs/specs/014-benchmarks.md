# #14 — State and national benchmark on every panel

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) · Status: draft

## Problem

Two of five panels compare to anything. A number with nothing beside it is not
information — "unemployment is 4.0%" means nothing without the national 4.3%.

## Approach

Every panel shows the state value and the national value, drawn from facts
already in the file: `geoid` equals the two-digit state FIPS, and `0100000US` for
the nation.

Three cases, all handled:

1. Both exist → a comparison row or a second series, plus a delta.
2. One exists → show it, name what is missing.
3. Neither exists → the panel says "no state or national series for this measure"
   rather than showing a lone number.

The national series are already present for unemployment, rent, home value,
income, population, poverty, education, age, CPI and mortgage rate. `gdp` and
`federal_obligations` have no national row; they get a state comparison only and
the panel says so.

## Acceptance criteria

- [ ] All five report panels show both benchmarks or explain the absence
- [ ] The comparison is drawn on the same scale as the local value
- [ ] A missing benchmark never renders as a zero or an empty bar
- [ ] The delta states which comparison it is against

## Risks

Benchmarks are not like-for-like: a county's GDP against a national GDP is a
ratio of unrelated magnitudes. Where the comparison is meaningless the panel uses
growth rates instead, per #29.

## Out of scope

Metro, peer-county, or same-size-cohort benchmarks.

## Files

`server/views/panel.ts` · `server/lib/panels.ts` · new `tests/benchmarks.test.ts`