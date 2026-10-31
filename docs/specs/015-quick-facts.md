# #15 — Quick facts grid

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) · Status: draft

## Problem

The file holds fourteen metrics and the report shows five. Median age, education,
poverty, labour force participation, home value and income exist and are invisible,
and the old app surfaced them in a secondary grid.

## Approach

A ten-value grid below the panels, two columns on desktop, one on the phone. Each
cell: label in 10px mono, value in 16px tabular, and the short receipt form
(agency and period only).

Values: median age, bachelor's or higher, poverty rate, labour force
participation, median home value, median household income, and the national CPI,
mortgage rate, and the count's share of its state.

No new data. Every value already has a fact row.

## Acceptance criteria

- [ ] Ten values render with a period and an agency
- [ ] No new pipeline source is introduced
- [ ] The grid collapses to one column under 720px
- [ ] Values are tabular and right-aligned

## Risks

A grid of ten numbers invites skimming past the receipts. The receipt stays
attached to each cell rather than moving to a footnote.

## Out of scope

Sparklines in the grid, sorting, user selection of which facts appear.

## Files

`server/view.ts` · `server/index.ts`
