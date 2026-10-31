# #30 — Legend and honest delta text on every two-series chart

Parent: #2 · Epic spec: [05-design-system](../remediation/specs/05-design-system.md) ·
Audit: [DESIGN-AUDIT](../../DESIGN-AUDIT.md) D3 · Status: draft

## Problem

The unemployment chart draws a solid teal line and a dashed deep-blue line and
never says which is which. The delta beside it reads "−0.9 pts vs 2026-08", which
describes the previous month while the dashed line shows the nation.

## Approach

- A legend line under every chart with two series, in draw order, 10px mono, with
  a solid and a dashed swatch.
- A single series gets no legend, per the skill.
- The delta text is generated from the same comparison the chart draws, so the
  two cannot disagree. One function produces both.

## Acceptance criteria

- [ ] Every two-series chart has a legend naming both series
- [ ] A single-series chart has none
- [ ] The delta names the comparison it is against
- [ ] Chart and delta are produced by one function, asserted in a test

### What changed while building it

The delta now measures the comparison the chart draws. It used to read
`−0.9 pts vs 2026-08`, a change since the previous month, beside a dashed line
that showed the nation. Both statements were true and together they were
misleading, which is the failure mode the spec named.

With two series the delta is `+0.3 pts above the United States`. With one series
it stays a change since the previous period. `seriesReadout()` returns the chart,
the legend and the delta from the same two arrays, so they cannot disagree.

## Risks

A legend that lists series in a different order from the draw order is worse than
none. The order comes from the same array the paths are built from.

## Out of scope

Interactive legends, toggling series, tooltips.

## Files

`server/views/charts.ts` · `server/views/panel.ts` · `server/views/css.ts` · new `tests/chart.test.ts`