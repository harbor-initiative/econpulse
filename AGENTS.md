# AGENTS.md

EconPulse — an open record of how American places are doing.

Version 1, written 2026-10-30 with the server split (#35). Update it in the same
commit as a change that makes it wrong.

This file is written for an agent that has the repository and no other context.
Read it before you run anything.

## 1. The house rules

These do not bend. A pull request that breaks one is not merged.

- **Every value carries its receipt.** Agency, dataset, table, period, retrieval
  date and margin of error travel with the number. A value without them does not
  ship.
- **No red, and no green.** Direction and quality are different things. Meaning
  is carried by a mono `better` or `worse` word in ink, against the national
  figure.
- **Hairlines, and no shadows.** One 1px rule separates. The search input is the
  only element allowed a shadow, and only for focus.
- **Colour stays under 5% of the viewport.** `--data` is a chart stroke and never
  text; it measures 3.6:1 on paper, under the 4.5:1 floor.
- **`server/views/css.ts` is the only stylesheet.** There is no second one, no
  CSS-in-JS, and no utility framework.
- **No framework, no router library, no bundler, no build step.** The server is
  `node:http`, the charts are hand-built SVG, and a stranger with Node runs it.
- **No antithesis in prose.** Write what a thing is. The construction that states
  a thing by denying its opposite reads as a tic in a data product.
- **Every route has a specification** in `docs/specs/`, and the spec wins when it
  disagrees with the code. Comment on the divergence instead of quietly fixing it.

## 2. How to run it

```bash
npm install
curl -sSL -o /tmp/ep.db.gz \
  https://github.com/harbor-initiative/econpulse/releases/download/v0.1.0-data/econpulse-2026.10.db.gz
mkdir -p data && gunzip -c /tmp/ep.db.gz > data/econpulse.db
npm run serve          # http://127.0.0.1:3100
```

Running the app needs no API key. The released database is the whole product:
19,142 places, 321,295 facts, 14 metrics, 109.8 MB, data version 2026.10.

| Command | What it does |
|---|---|
| `npm run serve` | The web server on `127.0.0.1:3100`. `PORT` and `HOST` override. |
| `npm run verify` | The data gate. 17 checks over the open database and the alias CSVs. |
| `npx tsc --noEmit` | The type gate. Clean is the only passing state. |
| `npm run mcp` | The same database over MCP, on stdio. Seven tools. |
| `node scripts/snapshot-html.mjs` | Write the rendered HTML of ten routes to `tests/snapshot-html/`. |
| `node scripts/snapshot-html.mjs --check` | Compare, and fail on any byte that moved. |
| `node scripts/design-check.mjs` | The design gate. Nine rules, six routes, three widths. |

**Rebuilding the data needs four keys** and is a separate job: `CENSUS_API_KEY`,
`BLS_API_KEY`, `BEA_API_KEY`, `FRED_API_KEY`, then `npm run load`. The Census API
refuses a keyless request with a 302 to `missing_key.html` and an
`X-DataWebAPI-KeyError` header, so a rebuild without a key looks like an empty
dataset rather than an error.

**Two gates must pass before a merge.** `npm run verify` and
`node scripts/snapshot-html.mjs --check`. A change that touches a page also runs
`node scripts/design-check.mjs`, and its failing count must not grow.

The design gate currently reports 54 failing assertions. That number is the
design debt in #34, measured. It is not a permission to add more.

## 3. The file map

```
server/
├── index.ts          entry point, 11 lines
├── app.ts            the router: route module answers true, or it did not run
├── routes/           one file per path
│   ├── home.ts       /  and  /s
│   ├── place.ts      /p/:geoid
│   ├── ask.ts        /ask
│   ├── status.ts     /status  and  /healthz
│   └── assets.ts     /robots.txt
├── views/            one file per component
│   ├── layout.ts     shell() and esc(); every view imports esc from here
│   ├── css.ts        the stylesheet
│   ├── panel.ts      one panel: label, value, visual, receipt
│   ├── charts.ts     line, bar, and compare rows
│   ├── report.ts     the full report
│   ├── ask.ts        the one-question card
│   ├── states.ts     "which place" and "which measure"
│   ├── home.ts, search.ts, status.ts, format.ts
├── lib/              shared behaviour, one concern per file
│   ├── runtime.ts    the open database handle and the build record
│   ├── metrics.ts    which measures exist, and the report order
│   ├── panels.ts     place + measure -> panel, including the county fallback
│   ├── http.ts       send() and redirect(); nothing else touches res
│   ├── aliases.ts    nicknames, state codes and metros, read from CSV at boot
│   ├── rules.ts      the local vocabulary a name is matched against
│   └── model.ts      the one call to a model
├── ask.ts            the question layer: parse a name, or ask the model
├── store.ts          every SQL query in the product
└── mcp.ts            the MCP server
data/aliases/         the three CSVs the alias map is built from
pipeline/             the loaders, the build, and the data gate
scripts/              the snapshot comparator and the design gate
docs/specs/           one specification per issue
tests/snapshot-html/  the rendered baseline the split is proved against
```

**A route imports views and lib. A view imports views and lib. A lib module
imports lib and store.** Nothing imports a route. `store.ts` holds the SQL, so a
query change is one file and not five.

No file in `server/` exceeds 200 lines. That limit is what stops two issues
colliding in one file.

## 4. The traps already paid for

Each of these cost a deploy. Read them before you touch the pipeline.

- **`_E$` never matches `B01003_001E`.** The estimate column ends in `1E`, so a
  suffix test for `_E` fails and the margin column is silently read as the
  estimate. Slice the last character instead: `code.slice(0, -1) + "M"`.
- **ZCTA codes are five digits and collide with county FIPS.** Loading ZIPs into
  `place` overwrote 1,470 counties. ZIPs live in their own table, `zcta`.
- **Census encodes "no value" as a negative sentinel**, and there are five of
  them: `-666666666` (not applicable), `-999999999`, `-888888888` (not
  available), `-222222222` (suppressed) and `-555555555` (too few samples for a
  margin). A missing sentinel becomes a number a reader will believe.
- **`openrouter/free` spends the token budget thinking.** Under 400 `max_tokens`
  it returns empty content with `finish_reason: length`. It also answers 429 on
  about one question in three, so the box needs a retry and a fallback.
- **Checkpoint the WAL before shipping the database.** `PRAGMA
  wal_checkpoint(TRUNCATE)`, or the release artifact is two files and the second
  one is missing.
- **The design gate measures pixels in a browser.** Reading the stylesheet proves
  nothing; a rule that was not measured has already been broken here once. Chrome
  under a strict parent sandbox also dies with `GPU process isn't usable.
  Goodbye.` unless it is started with `--no-sandbox`, which is why the gate
  passes that flag.

## Where the detail lives

| Need | File |
|---|---|
| Why the rebuild has gaps | `docs/remediation/RESEARCH.md` |
| The three adversarial reviews | `docs/remediation/REVIEWS.md` |
| The design system and its gate | `docs/remediation/specs/05-design-system.md` |
| Every issue's specification | `docs/specs/` |
| The factory: lanes, rules, contract | `docs/FACTORY.md` |
