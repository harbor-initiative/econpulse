# #33 — Choose and self-host the typefaces

Parent: #2 · Epic spec: [05-design-system](../remediation/specs/05-design-system.md) ·
Audit: [DESIGN-AUDIT](../../DESIGN-AUDIT.md) D6 · Status: draft

## Problem

Georgia for the place name is a choice. The system sans everywhere else is a
default, and a page built from defaults reads as a kit. `taste-skill` calls a stock face on a stock ground "a well-applied kit".

## Approach

Two SIL OFL faces, self-hosted, subset, no CDN so the page works offline:

- **Display:** Source Serif 4, weight 500, used once — the place name.
- **Interface:** Inter Tight, 400/500/600.

Both subset to Latin-1 plus the punctuation the page actually uses. Budget 60 KB
total across all weights.

Pick by setting the same header block in both candidates and looking at it. That
comparison is recorded in this file before the choice is made.

### The comparison, recorded

The alternative pair was the one shipping: `Georgia` for the display, the system
sans everywhere else. Rendered side by side on `/p/42101` at 1440px:

| | Georgia + system sans | Source Serif 4 + Inter Tight |
|---|---|---|
| Place name | wider, rounder, reads as a newspaper column | tighter, more vertical, reads as a record |
| Interface | the face of whatever OS the reader uses | one face on every platform |
| Download | 0 | 46.6 KB, subset, immutable-cached |
| Offline | renders, because both are local | renders, because both are self-hosted |

The deciding argument is the one the audit made: a page built from the operating
system's defaults reads as a kit. The system sans is not a choice, it is an
absence of one. Source Serif 4 in one weight also does the job that a display
face is for, which is being the only display face.

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

new `public/fonts/*.woff2` · `server/views/css.ts` · `server/routes/assets.ts` ·
`server/lib/http.ts` · `Dockerfile` · `scripts/lib/cdp.mjs` · new
`scripts/font-check.mjs` · `tests/snapshot-html/*`

Three of those are not in the original list and are not optional. The server had
no static route, so the fonts needed one; a binary response needed a `sendBinary`
with an immutable cache; and the image had to copy `public/` or production would
404 both faces.