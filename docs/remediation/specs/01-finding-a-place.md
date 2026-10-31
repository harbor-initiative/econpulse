# Spec 1 — Finding a place

Status: draft · Owner: unassigned · Depends on: nothing
Decision source: interview 2026-10-30, decisions 1 and 2.

## Problem

The rebuild can only find a place if the person types an administrative name
exactly, or a five-digit ZIP. Everyone else gets a results page or a dead end.

Evidence from the code:

- `server/store.ts` `searchPlaces` runs `name LIKE '%q%'`, ordered by kind then
  population. No prefix boost, no typo tolerance, no ranking beyond "county
  before city, then biggest".
- `pipeline/sources/census.ts` drops every place under 1,000 people
  (`MIN_PLACE_POPULATION`), 16,463 of 32,330. The old app kept all of them.
- There is no alias table. "Philly", "NYC", "LA" and "the Bay Area" all fail.
- There is no autocomplete endpoint. The old app had `/api/suggest` and a
  101-entry metro index.
- There is no "use my location". The old app had `reverse-geocode.ts`.
- The old app resolved a city to its metro and listed nearby places
  (`nearby-locator.ts`). The rebuild has nothing.

The failure the operator hit on 2026-10-30: `20744` returned "I need a place to
answer that." ZIP support now exists, which fixes this one string and none of the
above.

## Decision

- Every incorporated place, county, ZIP and state is findable. The 1,000-person
  filter comes off the **facts**; the index covers everything regardless.
- Search is served from an in-process index, not from SQL, so ranking and fuzzy
  matching are ours to control.

## Design

### 1. Separate the index from the facts

Two concepts, already partly true in the schema:

- `place` + `zcta`: **what can be found**.
- `fact`: **what can be said**.

A place with no facts must still resolve. The report then says what it has and
what it borrowed, which the panel fallback already does for counties.

### 2. Lift the filter

`pipeline/sources/census.ts`: default `MIN_PLACE_POPULATION` to `0`, keep the
environment variable so a lean build is still possible.

Measured before and after, recorded here when done: place count, file size,
build time. Expect 19,142 → 35,605 places, 110 MB → roughly 160 MB, and about
150 s → 240 s.

### 3. An alias table

```sql
CREATE TABLE alias (
  term  TEXT PRIMARY KEY,   -- lowercased, no punctuation
  geoid TEXT NOT NULL,
  kind  TEXT NOT NULL       -- nickname | abbreviation | metro
);
```

Seeded from three sources, all committed as data files so they are reviewable:

- `data/aliases/nicknames.csv` — Philly, NYC, LA, SF, DC, NOLA, Vegas, Chi,
  H-Town, the Bay Area, Twin Cities, DMV, SLC, ATL, PDX, SEA, MIA, BOS.
- `data/aliases/states.csv` — every state abbreviation and common variants.
- `data/aliases/metros.csv` — the 101 entries from the old `top-metros.ts`,
  which is already a curated list and should not be thrown away.

Alias lookup runs before fuzzy search. An alias hit is an exact answer.

### 4. In-process index with fuzzy matching

At boot, load every place into memory:

```ts
interface IndexEntry {
  geoid: string; name: string; norm: string; kind: string;
  stateCode: string | null; population: number | null; aliases: string[];
}
```

Roughly 52,000 rows, about 4 MB in memory, loaded once in ~80 ms.

Ranking, in order:

1. Exact alias.
2. Exact normalized name.
3. Prefix match on normalized name.
4. Trigram overlap ≥ 0.6, tie-broken by population.
5. Substring match.

`norm` = lowercased, punctuation stripped, `city|town|village|borough|cdp`
suffix removed, "county" kept because it is a real distinction.

This replaces the `LIKE` scan and gives typo tolerance ("Philadelpia",
"Pittsburg") for free.

### 5. `GET /api/suggest?q=`

Returns `{ suggestions: [{ geoid, name, kind, stateCode, population, score }] }`,
maximum 10, ranked as above. Cache-Control 300. Debounced client-side at 120 ms.

The old app's `/api/suggest` is the shape to match; it is referenced in
`RESEARCH.md`.

### 6. Autocomplete in the box

A `<datalist>` will not do; it cannot show kind or population. A small accessible
combobox: `role="combobox"`, `aria-activedescendant`, arrow keys, Enter, Escape.
Keyboard-first, because the box is the product.

Each row shows: name, state, kind, population. The kind matters — "Philadelphia
city" and "Philadelphia County" are different answers and the old app did not
distinguish them clearly.

### 7. Use my location

`navigator.geolocation` → `GET /api/here?lat=&lon=`. Server resolves to the
containing county using a point-in-polygon test against the county boundaries
already downloaded for the map work.

If the map work is not done, this waits. It is the lowest-priority item in this
spec because a ZIP is a better answer nine times in ten.

### 8. Nearby places

Out of scope for this spec. Recorded in `RESEARCH.md` as a gap; it depends on
the map boundaries and belongs with them.

## Acceptance criteria

1. `20744` resolves to Prince George's County with a notice naming the ZIP.
2. `Philadelpia` resolves to Philadelphia County.
3. `Philly` resolves to Philadelphia.
4. `NYC` resolves to New York County.
5. Typing three characters returns suggestions within 100 ms on the server.
6. A place of 400 people resolves and renders a report.
7. A place with no facts renders the county fallback with the county named.
8. The box is usable with the keyboard only, and announces the active option.
9. Every suggestion shows its kind, so a city and a county of the same name are
   distinguishable before the click.
10. `verify` fails if the alias table is empty or if any place above 1,000 people
    lacks a fact row.

## Risks

- **File size.** Doubling place count grows the artifact. Mitigated by measuring
  first and keeping the filter switchable.
- **Memory.** A 52,000-entry index adds roughly 4 MB RSS. Acceptable on a 1 GB
  box; measured at boot.
- **Ranking is editorial.** "Biggest wins" is a choice. The spec fixes the order
  so the choice is visible and testable.

## Out of scope

Saved places, search history, geocoding of street addresses, nearby places,
metro rollups, and any client-side index. The client index is a later
optimisation recorded in the CTO review.

## Files touched

`pipeline/schema.sql`, `pipeline/sources/census.ts`, `pipeline/verify.ts`,
`server/store.ts`, `server/index.ts`, `server/view.ts`, new
`server/search-index.ts`, new `data/aliases/*.csv`, new `tests/search.test.ts`.
