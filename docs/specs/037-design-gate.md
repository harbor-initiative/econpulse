# #37 — The measurement gate: scripts/design-check.mjs

Parent: #34 · Status: built · Prerequisite of: #35, then every issue that touches a page

## Problem

The design system states nine rules. Nothing measured any of them. Every rule in
this repository that was not measured has already been broken at least once: the
ZIP table shipped without a gate and returned 500s for a day, and the report
carries a 35px heading on an app screen that three reviews caught by eye.

Two acceptance criteria depend on a gate that did not exist:

- #35 says "the browser gate (#34) passes before and after the split".
- #34 says "the gate runs in CI and blocks a merge".

[Spec 05](../remediation/specs/05-design-system.md) Part 3 specifies the gate in
detail, and no issue owned it. The epic says "do not build it, build its
children", and none of the five children covers Part 3. That is a hole in the
graph, so it gets its own file and its own issue.

## Approach

`scripts/design-check.mjs`. Node 22, the installed Chrome, and nothing else. No
npm dependency, because a gate that needs an install is a gate that gets skipped.

Three pieces, each small enough to read:

| File | Job |
|---|---|
| `scripts/lib/cdp.mjs` | launch Chrome, one page target, `evaluate`, `screenshot`, and a PNG decoder |
| `scripts/lib/probe.mjs` | the expression evaluated in the page; returns numbers, makes no judgements |
| `scripts/design-check.mjs` | nine rules over those numbers, a deterministic record, and an exit code |

It boots the server itself against the fixture database, so it cannot measure a
stale process, and it runs with `OPENROUTER_API_KEY` empty so a model answer
cannot make the record move.

Six routes at three widths: `/`, `/p/42101`, `/p/4260000`,
`/ask?q=Is+rent+going+up+in+Austin`, `/status`, and a 404. Eighteen renders.

### The nine rules

| # | Rule | Measured how |
|---|---|---|
| G1 | colour budget: ≤5%, warn above 3% | decode the screenshot, count pixels with chroma ≥24 |
| G2 | no `box-shadow` except the search input | computed style, every element |
| G3 | no heading above 24px except the place name (28) and the score (46) | computed `font-size` |
| G4 | a chart with two series has a legend sibling | dashed stroke present, `.legend` absent |
| G5 | every text colour ≥4.5:1, or 3:1 at 24px and above | WCAG ratio against the nearest painted background |
| G6 | every `[data-number]` computes `tabular-nums`, and a report page has at least one | computed `font-variant-numeric` |
| G7 | no horizontal scroll at 390px | `scrollWidth` against `innerWidth` |
| G8 | every panel contains a visual | `svg`, `.compare`, or `[data-visual]` inside the panel |
| G9 | the top bar carries a search input | DOM query |

### The threshold on G1

`#009689` reaches chroma 150 and `#104E64` reaches 84. Every neutral in the
palette sits at or under 19 (`#566669`). A threshold of 24 separates data colour
from grey with no argument about antialiasing, and it does not need a list of
allowed colours to stay correct when the palette changes.

## What it found

The first run, on the code as it stood at `315fd07`:

| Rule | Failing renders | What it caught |
|---|---|---|
| G3 | 18 of 18 | 40px `h1` on the home page, 35.2px place name, 25.6px on every other route |
| G4 | 6 | both report routes draw a dashed national series with no legend |
| G6 | 6 | no `[data-number]` marker anywhere, so tabular figures are unpinned |
| G8 | 6 | the population panel is a value and a receipt |
| G9 | 18 of 18 | no search in the top bar on any route |
| G1, G2, G5, G7 | 0 | passes: 0–2.2% coloured pixels, no shadows, contrast holds |

**54 failing assertions across 18 renders.** That number is the design debt #34
exists to pay. It is recorded in `tests/design-gate-baseline.json` so a later
change that moves it is visible.

**Passing today does not mean the gate works.** A gate that never fails is
decoration. The 54 are the proof it measures something real.

## Acceptance criteria

- [x] `node scripts/design-check.mjs` runs with no npm dependency beyond the repo
- [x] Nine assertions, six routes, three widths, and an exit code that fails the build
- [x] `--json` writes a deterministic record, so a refactor can be proved not to have moved it
- [x] The gate skips with a warning and a non-zero exit under `CI` when Chrome is absent
- [x] The baseline is committed as `tests/design-gate-baseline.json`
- [x] The gate is documented in `AGENTS.md`

## Risks

- **A page with no colour passes G1.** G8 and the panel-visual rule exist so that
  restraint cannot become emptiness.
- **Chrome needs `--no-sandbox` under a strict parent sandbox.** Without it the GPU
  process dies, the browser exits with `GPU process isn't usable. Goodbye.`, and
  every later CDP command closes the socket. The first version of this gate hung
  for four minutes on exactly that.
- **A gate that measures pixels can drift with a font change.** That is a real
  measurement and the record makes the drift visible instead of silent.

## Out of scope

The CI wiring. The repository has no `.github/` yet, and that directory belongs to
lane L6 (#27). Until a workflow exists, this gate is a command a person or an
agent runs before a merge, and the acceptance criterion in spec 05 that says CI
blocks a merge stays open against L6.

Making the 54 pass. That is #34 and its children #29–#33. The print stylesheet
and the PDF export (#17) are a later assertion on the same gate.

## Files

new `scripts/design-check.mjs` · new `scripts/lib/cdp.mjs` · new
`scripts/lib/probe.mjs` · new `scripts/lib/server.mjs` · new
`tests/design-gate-baseline.json` · `docs/specs/README.md` · `docs/FACTORY.md`
