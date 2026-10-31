# Spec 5 — The design system and the cleanup

Status: draft · Owner: unassigned · Depends on: Spec 2 (header block), Spec 3 (states)
Decision source: [DESIGN-AUDIT.md](../DESIGN-AUDIT.md), which measures the live
report against `Leonxlnx/taste-skill` and `jakubkrehel/skills`.

## Problem

The report is disciplined and unfinished. It passes the colour budget, the flat
surface rule and the KPI rule, and it fails six others: a 35px heading on an app
screen, an unlabelled second series, no search on a place page, panels that are a
number and a receipt, no face of its own, and 90px of dead space.

Worse, none of it is gated. The design doc states rules and nothing checks them.
Every rule in this repository that is not measured has already been broken at
least once — the ZIP table shipped without a gate and returned 500s for a day.

## What this spec is

Not a visual redesign. A **system** with two halves:

1. The decisions, written once, that every screen is built from.
2. A **measurement gate** that fails the build when a screen breaks them.

The second half is the point. `taste-skill` calls its version `inspect.mjs` and
runs it in a real browser, because a rule checked by reading CSS is a hope.

## Part 1 — Foundations

### 1.1 Type

Two faces, both SIL OFL, both self-hosted as subset woff2, no CDN.

| Role | Face | Weight | Size | Use |
|---|---|---|---|---|
| Display | Source Serif 4 | 500 | 28 / 22 mobile | the place name, and only that |
| Interface | Inter Tight | 400 | 15 | body, summaries, prose |
| Interface | Inter Tight | 500 | 13 | labels, table cells |
| Interface | Inter Tight | 600 | 26 | metric values |
| Interface | Inter Tight | 600 | 46 | the score |
| Data | system `ui-monospace` | 400 | 10–11 | receipts, labels, axes, versions |

Rules:

- **One display face, one use.** The serif appears on the place name and nowhere
  else. A second use dilutes it.
- **All numerals are tabular.** `font-variant-numeric: tabular-nums` on every
  element holding a number, so columns do not shift between outcomes.
- **No text under 10px.** The current 9.5px receipt is the floor and it rises to
  11px when promoted.
- **Loading order:** `font-display: swap`, with a metric-compatible fallback
  (`Georgia` for the serif, `system-ui` for the sans) so the layout does not jump.

Subset to Latin-1 plus the punctuation actually used. Budget: 60 KB total, both
faces, all weights.

### 1.2 Colour

The palette is fixed. There is no accent colour for chrome.

| Token | Value | Permitted use |
|---|---|---|
| `--paper` | `#FCFBF8` | page and panel ground |
| `--ink` | `#16161E` | text, rules on emphasis |
| `--muted` | `#52555B` | secondary text |
| `--receipt` | `#566669` | provenance lines |
| `--rule` | `#E4E2DC` | 1px separators |
| `--rule-strong` | `#C9C7C0` | input borders |
| `--data` | `#009689` | **chart strokes and bars only** |
| `--data-ink` | `#0B5C55` | text that reads as data |
| `--compare` | `#104E64` | the second series, dashed |
| `--stale` | `#8A6A00` | the staleness strip text |
| `--stale-bg` | `#FFF9EC` | the staleness strip ground |

Hard rules:

- **`--data` is never text.** It measures 3.6:1 on paper, under the 4.5:1 floor.
  Chart strokes are graphical objects and pass at 3:1; type does not.
- **No red, no green, ever.** Direction is not the same as good. Meaning is
  carried by a mono `better` / `worse` word in ink against the national figure.
- **Colour budget: ≤5% of the viewport, target ≤3%.** Measured, not estimated.
- **Colour never appears on chrome** — no tinted nav, no filled primary button,
  no coloured card. The page has no primary button at all.

### 1.3 Space

A 4px scale: 4 · 8 · 12 · 16 · 24 · 32 · 48. Nothing between steps.

- **Group with space before lines.** The gap between groups is at least twice the
  gap within one.
- **Two alignment edges.** A single left edge and a single right edge per screen;
  numbers right-aligned against the right edge.
- **No dead bands.** A vertical gap larger than 32px must contain something.

### 1.4 Surfaces and shape

- **Hairlines, not shadows.** `box-shadow: none` on every element except the
  search input, which keeps one for focus affordance only.
- **Radius 6px for interactive controls.** Data surfaces are square. A rounded
  card holding a number is a tile, and this is not a tile interface.

### 1.5 Motion

One thing moves: the value counts up once over 600ms on first paint. Charts do
not draw. `prefers-reduced-motion` removes the count-up and leaves the number.

## Part 2 — Components

Each is specified as anatomy, not prose. The names are the ones the code should
carry.

### 2.1 `TopBar`

56px tall, 1px `--rule` bottom border. Three zones: product name, docked search,
nav. The search is present on **every** page and is the first focusable element.

### 2.2 `HeaderBlock`

```
crumb        10px mono uppercase, --receipt
place        28px serif 500, 2-line clamp
scope        13px --muted: population · share of state · GEOID
───────────  1px --ink
score        46px 600 tabular · label 10px mono · weights 10px mono
summary      15px, max 60ch, no digit it cannot source
───────────  1px --rule
receipt      11px mono, --ink agency · --receipt date, teal left rule 2px
```

The score is the largest number on the page. The place name is second. Nothing
else competes.

### 2.3 `Panel`

```
label        10px mono uppercase, --receipt
value        26px 600 tabular
delta        13px --muted, with a better/worse mark where a national value exists
visual       one of: time series · scaled comparison · share bar
legend       10px mono, only when two series are drawn
receipt      10px mono, --receipt, teal left rule 2px
```

**A panel must justify its cell.** One of the three visuals is mandatory. A panel
that is a value and a receipt is a defect, not a layout.

### 2.4 `CompareRows`

Three rows: this place, the state, the nation. Bars share one scale, set to the
largest value in the set. Each row prints its number. Compared quantities must be
the same kind — **growth rates, never totals**, because a 959,754 county on the
same axis as a 334,922,499 country is not a chart.

### 2.5 `Chart`

- Two series maximum. A third means two charts.
- Primary 1.7px solid `--data`; comparison 1.2px dashed `--compare`.
- One baseline rule. No gridlines, no box, no y-axis spine.
- Start and end period printed under the chart in 10px mono.
- Legend below when there are two series, in draw order. A single series has none.
- Height 46px in a panel, 84px in a card, 40px on a phone.
- The SVG is `aria-hidden`; the table alternative is the accessible path.

### 2.6 `Receipt`

Two sizes, one idea.

- **Promoted**: once per page, under the header block, 11px, agency in `--ink`,
  date in `--receipt`, 2px teal left rule.
- **Panel**: under each panel, 10px, same rules, quieter.

### 2.7 `StatusStrip`

Five states, each its own sentence and its own shape.

| State | Shape |
|---|---|
| Fresh | nothing rendered |
| Aging | nothing rendered, date in the panel receipt |
| Stale | amber background strip, 1px amber rule, source and age named |
| Loading | the shell with a progress line naming the step |
| Error | the shell with the specific failure named, never a stack trace |

## Part 3 — The measurement gate

`scripts/design-check.mjs`. Node plus the installed Chrome, no dependencies
beyond what the repo already has.

It boots the server against the fixture database, loads each route at three
widths (1440×900, 1024×768, 390×844), and asserts:

| # | Assertion | Why |
|---|---|---|
| G1 | coloured pixels ≤5%, warn above 3% | the colour budget, measured from the screenshot |
| G2 | no `box-shadow` other than the search input | flat surfaces |
| G3 | every heading ≤24px except the place name (28) and the score (46) | no hero header |
| G4 | every chart with two series has a legend sibling | unlabelled lines |
| G5 | every text colour ≥4.5:1 against its background | contrast |
| G6 | every `[data-number]` computes `tabular-nums` | column stability |
| G7 | no horizontal scroll at 390px | narrow screens |
| G8 | every panel contains one of the three visuals | thin panels |
| G9 | the top bar contains a search input | search on every page |

Routes covered: `/`, `/p/42101`, `/p/4260000`, `/ask?q=Is+rent+going+up+in+Austin`,
`/status`, a 404, and the print stylesheet via PDF export at the same time.

The script exits non-zero with the failing assertion and the route. CI runs it on
every push, next to `verify`.

## Acceptance criteria

1. Both faces self-host, subset, under 60 KB, and the page renders with the CDN
   blocked.
2. Every route passes all nine gate assertions at all three widths.
3. The header block renders in the specified order with the score as the largest
   number.
4. No panel renders without a visual.
5. No chart draws two series without a legend.
6. No delta prints without a better/worse mark where a national value exists.
7. The top bar carries a search field on every route.
8. Print produces one column, receipts, and the data version in the footer.
9. The gate runs in CI and blocks a merge.
10. The design doc and this spec do not disagree; where they do, this spec wins
    and the doc is corrected.

## Risks

- **A gate that measures colours can be gamed** by a page with no colour. G8 and
  the panel-visual rule exist to stop restraint becoming emptiness.
- **Two faces add a download.** Subsetting and `swap` keep it under 60 KB; a
  failure to subset is visible in the gate as a render delay, not a failure.
- **The gate needs Chrome.** CI images include it; a contributor without it gets
  a skip with a warning, never a silent pass.

## Out of scope

Dark mode. A component library. Icons. Illustration. Any animation beyond the
single count-up. A design tool file.

## Files touched

`server/view.ts` (the CSS and the markup), new `public/fonts/*.woff2`, new
`scripts/design-check.mjs`, new `.github/workflows/design.yml`,
`server/index.ts` for the data attributes the gate reads.
