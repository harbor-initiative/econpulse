# Contributing

Two rules matter more than the rest.

**Every value carries a receipt.** A fact is not written without `agency`,
`dataset`, `vintage`, `retrieved_at`, and `period`. If a source cannot supply
those, it does not go in the file.

**The build must fail loudly.** `npm run verify` is the gate. A number that moves without anyone meaning it to is a bug. A refresh is deliberate and recorded.

## Adding a source

A source is four files' worth of work, and about a day.

1. **`pipeline/sources/<name>.ts`** — export `load<Name>(db: DatabaseSync)`.
   Fetch, parse, and write facts through `makeFactWriter`. Return
   `{ places, facts }`.
2. **`pipeline/build.ts`** — add it to `SOURCES` with the env vars it needs.
3. **`pipeline/verify.ts`** — add two pinned numbers from that source.
4. **`tests/<name>.test.ts`** — one saved fixture response and its expected
   parse. No network in tests.

### The shape of a fact

```ts
writer.write({
  geoid: "42101",                 // Census GEOID of the place
  metric: "unemployment_rate",    // must exist in the metric table
  period: "2026-09",              // the window the value describes
  value: 4.8,
  agency: "U.S. Bureau of Labor Statistics",
  dataset: "Local Area Unemployment Statistics",
  table_id: "LAUS",
  vintage: "2026-09",
  retrieved_at: "2026-10-30",
  moe: null,                      // margin of error, if the source has one
  revision: "provisional",        // final | provisional | annual
  note: "Not seasonally adjusted",
});
```

`period` is not the retrieval date. A 2020–2024 five-year estimate published in
2025 and pulled in 2026 has `period = "2020-2024"`, `vintage = "2024"`, and
`retrieved_at = "2026-10-30"`. Conflating those three is the most common way to
make a data product dishonest.

### Sentinels

Federal APIs encode "not available" in the value itself. Census uses
`-666666666`, `-999999999`, `-888888888`, `-222222222`, and `-555555555`. BLS and
USAspending use `null` and empty strings. Anything not in `SENTINELS` is parsed
as a number and will land in the file as a real value, so add new ones when you
find them.

### Suffixes

Census columns end in `E` for estimate and `M` for margin. Slice the last
character; do not regex `_E$`. It does not match `B01003_001E`, and the failure
is silent: the estimate lands in the margin column and every check still passes
except the one that compares them.

## Running things

```bash
npm run load                 # rebuild the file from zero
npm run load --only=census   # one source
npm run load --keep          # add without clearing
npm run verify               # the gate
npm run typecheck
```

## Style

- TypeScript, strict, no `any`.
- No dependencies in the pipeline beyond Node. `node:sqlite` and `fetch` are
  enough, and every dependency added is one a contributor has to trust.
- Comments explain *why*, never *what*. If a line needs a comment to say what it
  does, rewrite the line.

## What not to add

- Accounts, payments, saved searches, or anything that needs a database server.
- A composite score that ranks places as good or bad. The file carries numbers
  and their receipts. The judgement belongs to the reader.
- Red and green for change. Direction is not the same as good.

## Licence

By contributing you agree your work is released under the MIT licence.
