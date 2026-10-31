# #5 — Alias table for nicknames, states, and metros

Parent: #1 · Epic spec: [01-finding-a-place](../remediation/specs/01-finding-a-place.md) · Status: draft

## Problem

`searchPlaces` matches `name LIKE '%q%'`. "Philly", "NYC", "LA", "Bay Area" and
"DMV" all return nothing, and they are how people actually name places. The old
app had no aliases either, so this is new ground rather than a regression.

## Approach

A table:

```sql
CREATE TABLE alias (
  term  TEXT PRIMARY KEY,   -- lowercased, punctuation stripped
  geoid TEXT NOT NULL,
  kind  TEXT NOT NULL       -- nickname | abbreviation | metro
);
```

Seeded from three committed CSVs so the list is reviewable in a diff:

- `data/aliases/nicknames.csv` — Philly, NYC, LA, SF, DC, NOLA, Vegas, Chi,
  H-Town, Bay Area, Twin Cities, DMV, SLC, ATL, PDX, SEA, MIA, BOS.
- `data/aliases/states.csv` — every USPS code and the common variants.
- `data/aliases/metros.csv` — the 101 entries from the old
  `data/top-metros.ts`, reused rather than rewritten.

Build step loads them into `alias`. Query order in the resolver: **alias first,
exact name second, fuzzy third.** An alias is an exact answer and must beat a
substring match.

A term that resolves to more than one GEOID is a build error.
The old app's peer suggester had the same problem and resolved it arbitrarily.

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

`data/aliases/*.csv` (new) · `pipeline/schema.sql` · new `pipeline/alias.ts` · `pipeline/verify.ts` · `server/store.ts` · new `tests/alias.test.ts`