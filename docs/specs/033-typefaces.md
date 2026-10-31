# #33 — Choose and self-host the typefaces

Parent: #2 · Epic spec: [05-design-system](../remediation/specs/05-design-system.md) ·
Audit: [DESIGN-AUDIT](../../DESIGN-AUDIT.md) D6 · Status: draft

## Problem

Georgia for the place name is a choice. The system sans everywhere else is a
default, and a page built from defaults reads as a kit. `taste-skill` puts it
plainly: stock Geist or Inter on a stock ground is "a well-applied kit, not a
product with its own identity".

## Approach

Two SIL OFL faces, self-hosted, subset, no CDN so the page works offline:

- **Display:** Source Serif 4, weight 500, used once — the place name.
- **Interface:** Inter Tight, 400/500/600.

Both subset to Latin-1 plus the punctuation the page actually uses. Budget 60 KB
total across all weights.

Pick by setting the same header block in both candidates and looking at it. That
comparison is recorded in this file before the choice is made, not after.

## Acceptance criteria

- [ ] Two faces chosen and the comparison recorded here
- [ ] Both self-hosted as woff2, subset, under 60 KB total
- [ ] The page renders identically with all external requests blocked
- [ ] `font-display: swap` with a metric-compatible fallback
- [ ] No layout shift beyond 0.05 CLS on load

## Risks

A font that fails to subset balloons the download. The gate measures transfer
size for the two font files.

## Out of scope

A third face, variable-font animation, icon fonts.

## Files

new `public/fonts/*.woff2` · `server/view.ts` · new `scripts/font-check.mjs`
