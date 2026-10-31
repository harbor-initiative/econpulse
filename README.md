# EconPulse

**Every number about a place, with its receipt.**

EconPulse answers one question: how is this place doing? Give it a city, county,
or ZIP and it returns population, income, rent, home value, jobs, output, and
federal money for that place, next to its state and the country.

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
| Sources | Census ACS 5-Year 2024 · BLS LAUS · BEA Regional · USAspending · FRED |
| Places | 19,142 — every state, every county, every place above 1,000 people, and the US |
| Metrics | 14 |
| Facts | 321,295 |
| File | 108 MB uncompressed, 9.4 MB gzipped |
| Rebuild | about three minutes, five agencies |

[Download the current file](https://github.com/harbor-initiative/econpulse/releases/latest).
The web app is in `server/`. Not built yet: the MCP server. See [the roadmap](#roadmap).

## Use the data

No clone, no install, no key.

```bash
curl -LO https://github.com/harbor-initiative/econpulse/releases/latest/download/econpulse-2026.10.db.gz
curl -LO https://github.com/harbor-initiative/econpulse/releases/latest/download/econpulse-2026.10.db.gz.sha256
shasum -a 256 -c econpulse-2026.10.db.gz.sha256
gunzip econpulse-2026.10.db.gz
sqlite3 econpulse.db "select metric, value, agency, vintage from fact where geoid='42101'"
```

Anything that reads SQLite works: `sqlite3`, DuckDB, Python, R, a notebook, an
agent.

```sql
-- Every fact about one place, with its receipt.
SELECT metric, value, moe, agency, dataset, vintage, retrieved_at
FROM fact WHERE geoid = '42101' ORDER BY metric;

-- The joined view, ready to chart.
SELECT place_name, metric_label, value, unit, agency, vintage
FROM fact_view WHERE geoid = '42101';
```

Geographies use the Census GEOID: a county is `42101`, a state is `42`, a place
is `4260000` (Philadelphia city), and the country is `0100000US`.

## Rebuild it

Maintainers only. Requires Node 22.5 or newer, for `node:sqlite`. No native
modules, no build step.

```bash
git clone https://github.com/harbor-initiative/econpulse.git
cd econpulse
npm install

cp .env.example .env      # Census and BEA keys, both free
npm run load              # writes data/econpulse.db
npm run verify            # the gate
```

`npm run load` rebuilds from zero. `npm run load --only=bls` adds one source
without touching the rest. `npm run load --keep` adds without clearing.

## Ask a question

The box takes a place or a question. A place gets the full report. A question
gets one card.

```
Is rent going up in Austin
Population of Cook County
Federal money in Philadelphia
```

The model is pinned to `openrouter/free`, a router that picks whichever free
model is up, so no single provider going down breaks the box. Override with
`ECONPULSE_MODEL`. Provider data collection is denied.

Most questions are answered **without a model**. The parser finds the measure
from a keyword table and the place from the local index, then runs a query. A
model is consulted only when that fails, only when `OPENROUTER_API_KEY` is set,
and it may only choose an id from a menu. It never sees a value and never
produces one, so a wrong choice yields the wrong question, not a wrong number.

## Run the site

The web app is a plain Node server: no framework, no bundler, no build step.

```bash
npm run serve              # http://127.0.0.1:3100
PORT=8080 npm run serve
```

`/` is the search box, `/p/:geoid` is the report, `/status` says what is in the
file, and `/healthz` is for a monitor. The whole server is three files and about
600 lines, which is the point: a self-hoster should be able to read it.

The charts are built as SVG strings from a small spec, so the same numbers can
be rendered again by an MCP client without touching the query layer.

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
the build if one is missing, if a margin duplicates its estimate, if two
agencies publish the same metric name, or if a pinned number moves.

## Keys

**Using the data needs no keys. Rebuilding needs two.**

| Source | Key | Why |
|---|---|---|
| Census | Required | The API returns `302 → missing_key.html` without one, as of 2026 |
| BEA | Required | County and state output |
| BLS | Required | The bulk flat file returns 403 to every client, so the API is the only route |
| FRED | Optional | Not yet used |
| USAspending | Not needed | Open |

That asymmetry is the design. Getting a key takes minutes, but nobody should
have to spend them to look up their own town. Whoever uses the data reads the
published file; whoever maintains it holds the keys.

## Known limits

- **No ZCTAs yet.** ZIP codes are the most natural way people ask this question
  and they are not in the file. Next.
- **Places are city boundaries, not metro areas.** A suburb's number is its own,
  not the region's.
- **BLS county figures are model-based estimates**, not a count. The note on
  every row says so.
- **ACS five-year figures are averages over five years.** They are not a
  current-year reading and they will disagree with BLS by design. Both are
  labelled.
- **Federal obligations are not outlays**, and they sit at the place of
  performance, not the contractor's address.

## Roadmap

- [x] Schema with a receipt on every value
- [x] Census, BLS, BEA, USAspending loaders
- [x] Publish the file as a release asset with a checksum
- [ ] ZIP code coverage
- [x] Web app — the one-page report
- [x] `econpulse.harborgovcon.com` behind Caddy
- [x] MCP server
- [ ] Automated staleness check

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). A new source is one file in
`pipeline/sources/`, one entry in the CLI, and a fixture. The provenance rule is
not negotiable.

## Use it from an agent

`server/mcp.ts` speaks MCP over stdio and exposes seven tools:

| Tool | What it answers |
|---|---|
| `search_places` | GEOIDs for a name, county, or ZIP |
| `get_place` | Everything about one place, with a receipt on each value |
| `get_metric` | One series, oldest first |
| `compare_places` | Two to five places side by side |
| `list_metrics` | Every measure, its unit, and its direction |
| `describe_data` | What is in the file, and what it does not cover |
| `county_for_place` | The county a city sits in |

```json
{
  "mcpServers": {
    "econpulse": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/econpulse/server/mcp.ts"]
    }
  }
}
```

Every tool returns the agency, the dataset, the vintage, and the retrieval date
alongside the number. An agent that quotes a figure without those is doing the
thing this project exists to prevent.

## Deploy

One container, Caddy in front. [deploy/README.md](deploy/README.md) has the
build, the vhost, and the rollback.

## Licence

Code is MIT. The data is public domain, published by the agencies named in every
row. EconPulse is not affiliated with any of them, and nothing here is financial
advice.
