# Spec 2 — The report

Status: draft · Owner: unassigned · Depends on: Spec 1 (place index), Spec 4 (data)
Decision source: interview 2026-10-30, decisions 4, 5 and 6.

## Problem

The rebuild's report is five numbers with receipts. It is a better record than
the old app and a worse answer. The old app opened with a verdict — a score out
of 100 and one of three words — and that is the sentence a resident repeats.

It also had, and the rebuild lacks: a state benchmark on every measure, a
freshness signal, a quick-facts grid, a map, a print stylesheet, and a table
alternative for anyone not reading a chart.

## Decision

- The score returns, with its weights visible.
- A plain-English summary is generated from the computed pillars by the model.
- The map is MapLibre with OpenFreeMap tiles, keyless, small, and a locator
  rather than a hero.
- Print is the only export.
- The receipt stays, and gets promoted rather than buried.

## Design

### 1. The header block

The page reads top-down as claim then proof.

```
COUNTY                                     ← breadcrumb
Prince George's County, Maryland           ← serif, 2rem, 2-line clamp
Maryland · population 959,754 · GEOID 24033
────────────────────────────────────────────
  62  Stable          Unemployment is above the   ← score, label, summary
                      national rate; rent is
                      below it; output is growing.
────────────────────────────────────────────
[ five panels of evidence, each with a receipt ]
```

- **Score** is an integer 0–100.
- **Label**: ≥67 Thriving · ≥34 Stable · <34 Strained, matching
  `overallStatusFromScore` in the old `scoring/score.ts`.
- **Weights printed** under the score in 11px mono:
  `jobs 30 · housing 25 · output 20 · population 15 · federal 10`.
- **Method link** to `/method`, one page, plain English.
- **Summary** is two sentences maximum, generated, and may not contain a number absent from the pillars. The result is cached per `(geoid, data_version)`.

### 2. How the score is computed

The old app invented formulas — `scoreAffordability = 100 - rentBurden * 140`.
Nobody can check that, and it is not reproducible across vintages.

**The rebuild uses a percentile against peers**, which is exact, checkable, and
needs no invented constants:

- At build time, for each metric, compute the value's percentile within its own
  kind (counties against counties, places against places).
- Direction from `metric.direction`: `higher_is_better` uses the percentile as
  is; `lower_is_better` uses `100 − percentile`; `neutral` is excluded from
  scoring but still displayed.
- A pillar's score is the mean of its metrics' scores.
- The overall is the weighted mean: jobs .30 · housing .25 · output .20 ·
  population .15 · federal .10.

Pillar membership:

| Pillar | Metrics |
|---|---|
| jobs | `unemployment_rate`, `labor_force_participation_rate` |
| housing | `median_gross_rent`, `median_home_value`, `median_household_income` |
| output | `gdp` |
| population | `population` |
| federal | `federal_obligations` |

Stored as a `percentile` column on `fact`, so the page does not recompute it and
the number is auditable with one query.

If a pillar has no data, it drops out and the remaining weights renormalise. The
page says so.

### 3. The summary

A single call to the same pinned model, one per place, cached.

Prompt contract, enforced in the prompt and by validation:

- Input: place name, the five pillar scores, the three strongest and three
  weakest metrics with their percentiles.
- Output: two sentences, no numbers, no advice, no predictions.
- Reject and fall back to a template if the output contains a digit.

Template fallback, so the page never renders empty:

> Unemployment is above the national rate. Rent is below it.

### 4. Freshness

Every panel already carries `retrieved_at`. Show it:

- **fresh** — newest fact under 35 days old
- **aging** — 35 to 120 days
- **stale** — over 120 days

A stale panel gets a small amber strip naming the source and the age. The page
header shows the newest and oldest fact dates. This is the trust feature the CTO
review put first.

### 5. Benchmarks

Every panel shows the state and the national value beside the local one, from
facts already in the file (`geoid` = state FIPS, `0100000US`). Today only two
panels do this.

### 6. Quick facts

A ten-value grid under the panels, from metrics not otherwise displayed:
median age, bachelor's or higher, poverty, labor force participation, home
value, income, and the CPI and mortgage rate for national context.

Each carries its receipt in the same format. No new data.

### 7. The map

- **MapLibre GL JS**, BSD-3, about 200 KB.
- Style from **OpenFreeMap**, keyless, no registration, no tracking.
- Overlay: the county or place boundary, from Census cartographic boundary
  GeoJSON, downloaded at build time and served from our own origin.
- Size: 200px tall, placed beside the header block.
- Offline: if tiles fail, the outline still renders from our GeoJSON. No error
  message; the map simply becomes an outline.

### 8. Print

A print stylesheet, because print is now the only export.

- One column, panels unbroken across pages.
- Receipts included.
- Footer prints URL, app version, data version, and the retrieval dates.
- Tested by generating a PDF.

### 9. Accessibility

- Every chart gets a `<details><summary>Table</summary>` with the underlying
  rows and their receipts. This is the promised table alternative and it was
  never built.
- Charts remain `aria-hidden`; the table is the accessible path.
- Contrast is already specified and gated in the design doc.

## Acceptance criteria

1. A report shows score, label, weights and a two-sentence summary.
2. The summary contains no digit.
3. Removing a pillar renormalises the weights and the page says which dropped.
4. `SELECT percentile FROM fact WHERE geoid='42101' AND metric='unemployment_rate'`
   returns a value that matches an independent computation.
5. Every panel shows state and national values, or says why not.
6. A panel older than 120 days shows an amber stale strip.
7. The map renders with tiles offline as an outline.
8. Print to PDF produces one column with receipts and the data version.
9. Every chart has a table alternative reachable by keyboard.
10. The page still works with JavaScript disabled: score, panels, receipts,
    and the map's outline.

## Risks

- **Percentile scoring changes with the peer set.** Adding places under 1,000
  moves every place's percentile. Percentiles are computed per kind and the
  peer count is printed, so the change is visible rather than silent.
- **The summary can drift into advice.** Validation rejects digits; a prompt
  check rejects "should", "we recommend", "consider".
- **Percentiles need the full peer set.** A lean build with the 1,000 filter on
  produces different scores. The data version must record which build produced
  it.

## Out of scope

Share images, CSV and JSON export, saved places, alerts, and any interactive
map feature beyond pan and zoom.

## Files touched

`pipeline/schema.sql` (percentile column), `pipeline/build.ts` (percentile pass),
`server/index.ts`, `server/view.ts`, new `server/score.ts`, new
`server/summary.ts`, new `public/styles/print.css`, new
`pipeline/sources/boundaries.ts`, new `tests/score.test.ts`.
