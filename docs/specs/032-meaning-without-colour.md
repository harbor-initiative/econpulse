# #32 — Meaning without colour: better/worse against the nation

Parent: #2 · Epic spec: [05-design-system](../remediation/specs/05-design-system.md) ·
Audit: [DESIGN-AUDIT](../../DESIGN-AUDIT.md) D5 · Status: draft

## Problem

`taste-skill` is explicit: *"a latency rise and a request rise were the same grey.
Colour on a change says good or bad, not up or down."* The current page prints
every delta in the same muted grey on purpose, and the judges in that study called
it hiding meaning behind restraint.

This project forbids red and green on principle. Both positions are right.

## Approach

Meaning without hue: a mono `better` or `worse` word, in ink, next to the delta,
computed against the national value and the metric's direction.

- `unemployment_rate` down → better
- `median_gross_rent` up → worse
- `gdp` up → better
- `population` → no mark; growth is not good or bad

The word is a `<span>` with a border-bottom. It survives greyscale, a
printed page, and colour blindness. It is read by a screen reader as text.

## Acceptance criteria

- [ ] Every delta with a national value carries better, worse, or nothing
- [ ] Neutral metrics carry no mark
- [ ] No hue signals good or bad anywhere on the site
- [ ] The mark is text
- [ ] The mark survives a greyscale screenshot

## Risks

The judgement is editorial. The direction comes from `metric.direction`, which is
data in the file, so the opinion is at least visible and reviewable.

## Out of scope

Scores on the delta, severity bands, trending arrows.

## Files

`server/views/panel.ts` · `server/lib/panels.ts` · `server/views/css.ts` · new `tests/delta.test.ts`