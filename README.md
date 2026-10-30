# EconPulse

**Every number about a place, with its receipt.**

EconPulse answers one question: how is this place doing? Give it a city, county,
or ZIP and it returns population, income, rent, home value, jobs, education, and
poverty for that place, next to its state and the country.

The difference is not the chart. It is that every value carries the agency that
published it, the table it came from, the period it describes, the vintage of
the release, the date it was pulled, and the margin of error where one exists.

Nothing here is a number without a source.

---

## Why this exists

Public data is free. The join is not.

The free civic layer of this space keeps disappearing. DataUSA archived its
public API in January 2022 and now runs as a commercial funnel. An open
reimplementation, `whatchanged.us`, shipped in March 2026 and stopped at six
stars. The commercial products that survive — Analisa, Social Explorer — are
closed, hosted, and priced per seat.

So this is the other thing: one SQLite file you can download, query, cite, and
run offline, with the provenance built into the schema instead of a footnote.

## What works today

| | |
|---|---|
| Sources | Census ACS 5-Year 2024 |
| Places | 19,142 — every state, every county, every place above 1,000 people, and the US |
| Metrics | 9 — population, income, rent, home value, median age, unemployment, labor force participation, bachelor's degree, poverty |
| Facts | 170,740 |
| File | 52 MB |
| Rebuild | about ten seconds |

Not built yet: BLS, BEA, USAspending, the web app, the MCP server. See
[the roadmap](#roadmap).

## Quick start

Requires Node 22.5 or newer, for `node:sqlite`. No native modules, no build step.

```bash
git clone https://github.com/harbor-initiative/econpulse.git
cd econpulse
npm install

cp .env.example .env      # add a Census key, free, takes two minutes
npm run load              # writes data/econpulse.db
npm run verify            # checks the receipts and pins five numbers
```

`npm run load` rebuilds from zero. `npm run load --keep` adds to the existing
file. `npm run load --only=census` runs one source.

## Read the file

The database is the product. Any SQLite client works.

```sql
-- Every fact about one place, with its receipt.
SELECT metric, value, moe, agency, dataset, vintage, retrieved_at
FROM fact
WHERE geoid = '42101'
ORDER BY metric;

-- The joined view, ready to chart.
SELECT place_name, metric_label, value, unit, agency, vintage
FROM fact_view
WHERE geoid = '42101';
```

Geographies use the Census GEOID, so a county is `42101`, a state is `42`, a
place is `4210100000`, and the country is `0100000US`.

## The data model

Three tables and a view.

- **`place`** — every geography, its kind, its parent, and its population.
- **`metric`** — what is measured, in what unit, and which direction is good.
- **`fact`** — the value, plus `agency`, `dataset`, `table_id`, `vintage`,
  `retrieved_at`, `moe`, `revision`, and `note`.
- **`fact_view`** — the three joined, which is what a chart should read.

`fact` is deliberately denormalised. Someone opening this file for the first
time should be able to run `SELECT * FROM fact LIMIT 5` and understand every
number without joining anything.

A fact is never written without all five receipt fields. `npm run verify` fails
the build if one is missing, if a margin duplicates its estimate, or if a pinned
number moves.

## Keys

**Running the app needs no keys. Rebuilding needs two.**

| Source | Key | Why |
|---|---|---|
| Census | Required | API returns `302 → missing_key.html` without one, as of 2026 |
| BEA | Required | Regional output |
| BLS | Optional | Raises the daily limit from 25 series |
| FRED | Optional | Raises macro context |
| USAspending | Not needed | Open |

That asymmetry is the design. Getting a key takes minutes, but nobody should
have to spend them to look up their own town. Whoever runs the app reads the
prebuilt file; whoever maintains it holds the keys.

## Roadmap

- [x] Schema with a receipt on every value
- [x] Census loader
- [ ] BLS loader — county unemployment, monthly
- [ ] BEA loader — county GDP, annual
- [ ] USAspending loader — federal obligations by place
- [ ] Person and ZCTA coverage
- [ ] Publish `econpulse.db` as a release asset with a checksum
- [ ] Web app — the one-page report
- [ ] MCP server

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). The short version: a new source is one
file in `pipeline/sources/`, one entry in the CLI, and a fixture test. The
provenance rule is not negotiable.

## Licence

Code is MIT. The data is public domain, published by the agencies named in every
row. EconPulse is not affiliated with any of them, and nothing here is financial
advice.
