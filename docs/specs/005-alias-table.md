# #5 — Alias table for nicknames, states, and metros

Parent: #1 · Epic spec: [01-finding-a-place](../remediation/specs/01-finding-a-place.md) · Status: draft

## Problem

`searchPlaces` matches `name LIKE '%q%'`. "Philly", "NYC", "LA", "Bay Area" and
"DMV" all return nothing, and they are how people actually name places. The old
app had no aliases either, so this is new ground rather than a regression.

## Approach

No table. `server/lib/aliases.ts` reads the three CSVs once at boot into a
`Map<string, string>`, and `server/store.ts` consults it. Nothing is written to
the database.

The lookup is a few hundred static rows. A table would force a full data rebuild
and a new release artifact before the feature worked, and the shipped
`data/econpulse.db` would stay stale until that rebuild landed, so the deployed
site would not have the aliases it had just shipped. In memory it costs one
small map and no migration.

Seeded from three committed CSVs so the list is reviewable in a diff:

- `data/aliases/nicknames.csv` — Philly, NYC, LA, SF, DC, NOLA, Vegas, Chi,
  H-Town, Bay Area, Twin Cities, DMV, SLC, ATL, PDX, SEA, MIA, BOS.
- `data/aliases/states.csv` — every USPS code except `LA`, which the nickname
  layer claims for Los Angeles, plus common variants.
- `data/aliases/metros.csv` — the 100 entries in the old app's
  `src/lib/data/top-metros.ts`, reused rather than rewritten. The old file has
  100 entries, not 101. Hartford and New Haven point at their city rows because
  Connecticut replaced its counties with planning regions, and the District of
  Columbia entry points at the district's state row so the report title is
  clean.

Resolver order in `store.ts`: **exact name, then alias, then fuzzy.** The exact
name check runs first so an alias never overrides a place a reader named
outright; the alias runs ahead of the `LIKE` scan, which is what "alias first"
means here. An alias is an exact answer and must beat a substring match.

A term that resolves to more than one GEOID has no correct answer. It fails
`npm run verify`, which reads the CSVs and names both GEOIDs, and it fails the
loader at boot. The old app's peer suggester had the same problem and resolved it
arbitrarily.

## Acceptance criteria

- [ ] `Philly` resolves to Philadelphia County
- [ ] `NYC` resolves to New York County
- [ ] `DC` resolves to the District of Columbia
- [ ] `Bay Area` resolves to a defined metro, recorded in the CSV
- [ ] An alias never overrides an exact name match
- [ ] A duplicate term fails `verify` with both GEOIDs named

## Risks

Ambiguity is real: "Springfield" names five places, so the resolver shows the picker. Aliases age; the CSV is data,
so correcting one is a one-line diff.

## Out of scope

User-defined aliases, dialect variants, non-English names.

## Files

`data/aliases/nicknames.csv`, `data/aliases/states.csv`,
`data/aliases/metros.csv` (new) · new `server/lib/aliases.ts` ·
`pipeline/verify.ts` · `server/store.ts` · new `tests/alias.test.ts`