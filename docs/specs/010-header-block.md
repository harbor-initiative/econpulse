# #10 — Header block: score, label, weights, summary

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) ·
Audit: [DESIGN-AUDIT](../../DESIGN-AUDIT.md) D1, D7, D8 · Status: draft

## Problem

The page has no header block, so it has nowhere to put a verdict. Adding a score
to the current top area produces four competing elements — crumb, 35px serif
name, scope line, build-date strip — with no hierarchy between them.

## Approach

One block, in this order, specified in
[Spec 5](../remediation/specs/05-design-system.md) §2.2:

```
crumb        10px mono uppercase
place        28px serif, two-line clamp
scope        13px: population · share of state · GEOID
───────────
score 46px · label 10px mono · peer reading 10px mono · weights 10px mono
summary      15px, max 60ch
───────────
receipt      11px, agency in ink, date in grey, 2px teal left rule
```

The place name drops from 35px to 28px so the score is the largest number on the
page. The 90px of dead space above the crumb goes; the top bar owns 56px and the
crumb begins 16px under it.

The peer reading is the second sentence the operator asked for: **62 among
counties · 55 among places**, in mono beside the label. The place's own kind is
the primary score; the other is the secondary reading. A county shows one.

The weights are visible without interaction: `jobs 30 · housing 25 · output 20 ·
population 15 · federal 10`, linked to `/method`.

## Acceptance criteria

- [ ] Renders in the order above at 1440×900
- [ ] Score is the largest number; place name is 28px
- [ ] Both peer readings render where both exist, labelled
- [ ] Weights visible without interaction and match `/method`
- [ ] One receipt above the fold, in ink
- [ ] No empty band above the crumb
- [ ] Mobile: the block stacks, score first, summary below

## Risks

A score invites comparison between places in a way five numbers did not. That is
intended, and `/method` must say plainly what the score is not.

## Out of scope

Trend of the score over time, percentile rank display, sharing.

## Files

new `server/views/header.ts` · new `server/lib/score.ts` · `server/routes/place.ts` · `server/views/report.ts`