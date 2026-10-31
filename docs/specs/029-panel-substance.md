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

The choice is data-driven: `series.length > 1` →
time series; else a comparison exists → comparison rows; else a share exists →
share bar.

**Compared quantities must be the same kind.** Growth rates compare to growth
rates. A 959,754 county on the same linear axis as a 334,922,499 country is not a
chart, and an early draft of the design did exactly that.

## Acceptance criteria

- [ ] No panel renders without one of the three visuals
- [ ] Comparison bars are scaled to their values and print their numbers
- [ ] Population compares growth rates, never totals
- [ ] A metric with a single period gets a comparison, so no cell sits empty
- [ ] The gate asserts the rule (#5 G8)

### What changed while building it

Three of the five report panels already had a visual after #14 and #18. Only one
did not: population, which has a single period in this file and therefore no
series to plot and no honest shared axis with a country.

It gets the third visual, a **share bar**: `12.13% of Pennsylvania · 1,579,706 of
13,018,639`. That is the one number that makes a county's population readable
next to its state.

**The measurement moved for the first time.** `node scripts/design-check.mjs`
reported 54 failing assertions before this change and 48 after: all six G8
failures — one panel, on two report routes, at three widths — are gone.

**One documented exception.** On `/p/0100000US` the population panel is the
nation's own total. It has one period and no parent, so it has no visual. The
gate does not visit that page; if it starts to, the page needs a different
treatment for the country as a whole, and that is a design decision rather than a
missing bar.

## Risks

Filling a panel for the sake of it produces chartjunk. The three allowed forms are
all meaningful; a fourth needs a design review.

## Out of scope

Sparklines, heatmaps, small multiples.

## Files

`server/views/panel.ts` · `server/views/charts.ts` · `server/routes/place.ts` · new `tests/panels.test.ts`