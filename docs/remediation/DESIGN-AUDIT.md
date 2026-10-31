# Design audit — two agent design skills, applied to EconPulse

Written 2026-10-31. Sources read in full: `Leonxlnx/taste-skill` (`SKILL.md` and
`references/app-screens.md`, 106k stars, MIT) and `jakubkrehel/skills`
(`better-interface`, `better-layout`, `interface-review`, 9.4k stars, MIT).

The point of both is the same: a model builds the average of everything it has
seen unless something forces a decision. These documents are that forcing
function. This audit takes their measurable rules, measures the live page against
them, and records where it fails.

---

## 1. The rules worth holding ourselves to

From `app-screens.md`, distilled from a study of 23 real product screens. The numbers are theirs.

| # | Rule | The number |
|---|---|---|
| R1 | Colour stays on the data | median 3% coloured pixels; 17 of 23 at ≤5% |
| R2 | KPIs are set as type | no icon in a tinted circle, no sparkline on a KPI |
| R3 | Surfaces are flat | 17 of 23 give cards no shadow; separation is a 1px line |
| R4 | No hero header on an app screen | 9 screens have no heading over 16px; where present the median is 24px |
| R5 | Charts carry almost no chrome | a single series has no legend; 3–7 faint gridlines or none |
| R6 | Navigation recedes | neutral pill or text colour, no coloured bar |
| R7 | Tables are rules and alignment | no zebra, no header bands, numbers right-aligned |
| R8 | Data states are honest | zeros print as zeros, missing as a grey dash, an empty section keeps its frame |
| R9 | Every named block shows at the fold | header and first rows visible at 1440×900 |
| R10 | The shell names the product and the scope | — |
| R11 | Colour on a change says good or bad, not up or down | — |
| R12 | The most frequent job is one click from the first screen | — |
| R13 | The screen has a face of its own | a chosen typeface and a ground tinted from the subject |

From `better-layout`: space groups first, lines last; the gap between groups is
at least 2× the gap within one; controls must look like controls; align to a
small set of edges.

From `better-interface`: **evidence, not taste.** A trigger is a failure whatever
the style guide says. A value you merely disagree with is not a finding.

---

## 2. How the current report measures

Measured on `https://econpulse.harborgovcon.com/p/42101` at 1440×900, 2026-10-31.

| Rule | Measured | Verdict |
|---|---|---|
| R1 colour budget | **2.2%** of the viewport is meaningfully tinted | pass — under the 3% median |
| R2 KPIs are type | large numerals, no icons, no sparklines | pass |
| R3 flat surfaces | no card shadows; 1px rules | pass |
| R4 heading | place name at **35px serif** | **fail** — above the 24px median |
| R5 chart chrome | baseline only, no gridlines | pass |
| R5 legend | unemployment chart has **two series and no legend** | **fail** |
| R8 honest states | missing series prints a sentence | pass |
| R9 fold composition | all five blocks show a header; the fifth is cut mid-chart | borderline |
| R10 shell names the product | "EconPulse" in the topbar | pass |
| R12 frequent job | **no search field on the place page** | **fail** |
| R13 a face of its own | Georgia for the place name; stock system sans everywhere else | **partial** |
| — dead space | ~90px of empty space above the crumb | **fail** |
| — thinness | the population panel is a number and a receipt, with ~120px of nothing under it | **fail** |

### What that looks like

- The population block occupies a full grid cell and contains two lines of text
  and a receipt. Under it is empty paper. The skill's warning is exact: *"a page
  that has lost its labels, rules and cards and gained nothing in their place
  reads as thin."*
- The unemployment chart draws a solid teal line and a dashed deep-blue line and
  never says which is which. The delta line reads "−0.9 pts vs 2026-08", which
  implies the comparison is the previous month, and it is not.
- The comparison bars for rent are the largest block of colour on the page, two
  full-width teal bars with no scale and no baseline. That is colour on chrome
  wearing the costume of data.
- There is no way to search another place from a place page. The topbar carries
  Status and GitHub. The most frequent job on a place report is "now show me a
  different place", and it costs a trip home.

---

## 3. Findings, ranked by how much they cost

**D1 — The page has no header block, so it has nowhere to put a verdict.**
Spec 2 adds a score and a summary. Dropping them into the current top area
produces four competing things: crumb, 35px serif name, sub-line, and a
build-date strip. There is no hierarchy to receive the score.
*Fix: a defined header block of five lines — crumb, place, scope, label+score,
summary — then the evidence. The 35px serif drops to 28px and the score is the
only element allowed to be as large.*

**D2 — Thin panels.** The population panel is the clearest case; output is
similar. A panel must justify its cell.
*Fix: every panel gets a chart, a comparison, or a sparkline. Where a metric has
one period, show it against the state and the nation as a two-bar comparison
with a shared scale and a printed baseline. No panel is a number and a receipt.*

**D3 — An unlabelled second series.** R5's counter-case: two series need a
legend, and the delta text currently misdescribes what the second line is.
*Fix: a legend line under the chart naming both series, and the delta text
recomputed so it describes the same comparison the chart draws.*

**D4 — No search on a place page.** R12.
*Fix: the search field is docked in the topbar on every page, not only on the
home page. It resolves the same way the home box does.*

**D5 — Colour on change is absent, and that is now a finding rather than a
principle.** R11 is explicit: *"a latency rise and a request rise were the same
grey; colour on a change says good or bad, not up or down."* The current page
prints every delta in the same muted grey on purpose.
*Fix: keep the no-red-green rule for the metric body, and add one semantic mark
that is not colour: a caret plus the words "better" or "worse" against the
national value, in ink. Colour stays off the delta; meaning does not.*

**D6 — No face.** R13. Georgia is a choice; the system sans is a default, and a
page built from defaults reads as a kit.
*Fix: choose a sans with character and ship it as a self-hosted woff2 — one file,
subset, no CDN. Candidates to try: Söhne (paid, no), IBM Plex Sans (OFL), Inter
Tight (OFL), Source Serif 4 for the display face to pair with it. That decision belongs in Spec 2.*

**D7 — Dead space above the crumb.** 90px of nothing.
*Fix: the topbar owns the top 56px and the crumb starts 16px under it.*

**D8 — Nothing tells you this page is different.** The receipt is the product and
it sits at 9.5px under each number.
*Fix: one promoted receipt above the fold, under the summary, at 13px, with the
agency and the retrieval date in ink rather than grey.*

---

## 4. What this changes in the backlog

| Finding | Issue |
|---|---|
| D1 header block | #10 rewritten to include the hierarchy |
| D2 thin panels | **new**: every panel must justify its cell |
| D3 unlabelled series | **new**: legend and honest delta text |
| D4 search everywhere | **new**: docked search on every page |
| D5 meaning without colour | **new**: better/worse mark against the nation |
| D6 a face | **new**: choose and self-host the typefaces |
| D7 dead space | folded into #10 |
| D8 promoted receipt | folded into #10 and #18 |

Issue #2 (the epic) and #10 (score header) are edited to reference this audit.
The rest are new issues with the `design` label.

---

## 5. The rule this audit will not break

The project's own rule survives: **no red, no green, no colour that says a number
is good or bad.** R11 asks for meaning. Hue is one way to carry it and not the only one. A caret and a word carry the
same information and survive colour blindness, greyscale printing and a
screenshot in a document.

That is the one place this audit departs from the skill, and it departs with a
reason rather than for taste.
