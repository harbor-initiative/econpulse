# #29 — Every panel must justify its cell

Parent: #2 · Epic spec: [05-design-system](../remediation/specs/05-design-system.md) ·
Audit: [DESIGN-AUDIT](../../DESIGN-AUDIT.md) D2 · Status: draft

## Problem

The population panel is a number and a receipt with roughly 120px of empty paper
under it. `taste-skill` names this exactly: *"a page that has lost its labels,
rules and cards and gained nothing in their place reads as thin."*

## Approach

A panel renders one of three visuals, or it does not render:

1. **Time series** — two or more periods.
2. **Scaled comparison** — this place, the state, the nation, one scale.
3. **Share bar** — this place as a proportion of its state.

The choice is data-driven, not per-metric hardcoded: `series.length > 1` →
time series; else a comparison exists → comparison rows; else a share exists →
share bar.

**Compared quantities must be the same kind.** Growth rates compare to growth
rates. A 959,754 county on the same linear axis as a 334,922,499 country is not a
chart, and an early draft of the design did exactly that.

## Acceptance criteria

- [ ] No panel renders without one of the three visuals
- [ ] Comparison bars are scaled to their values and print their numbers
- [ ] Population compares growth rates, never totals
- [ ] A metric with a single period gets a comparison, not an empty cell
- [ ] The gate asserts the rule (#5 G8)

## Risks

Filling a panel for the sake of it produces chartjunk. The three allowed forms are
all meaningful; a fourth is a design review, not an improvisation.

## Out of scope

Sparklines, heatmaps, small multiples.

## Files

`server/view.ts` · `server/index.ts` · new `tests/panels.test.ts`
