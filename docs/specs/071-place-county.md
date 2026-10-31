# #71 — A city borrows its county's figures by name, and the name is often wrong

Parent: none · Status: draft · Found in: #69

## Problem

`countyForPlace()` matches a city to a county by name. A name is not a
geography, and for the most likely query in the product the answer is wrong.

| Place | County it borrows | County it is in |
|---|---|---|
| Austin city, Texas | **Austin County** (31,170) | Travis County (1,330,015) |
| Nashville-Davidson, Tennessee | **none** | Davidson County (715,388) |
| Philadelphia city, Pennsylvania | Philadelphia County | Philadelphia County |

Austin's `gdp`, `federal_obligations` and `unemployment_rate` panels say
"Reported for Austin County, the county this place sits in". They are wrong, and
the page says so in a sentence that reads as provenance.

`place.parent_geoid` holds the **state** FIPS for a city, so the file cannot
answer the question today.

## Approach

A `place_county` table written by the pipeline from the Census place-to-county
relationship file, which is the same family the ZIP loader already uses:

```sql
CREATE TABLE place_county (
  place_geoid TEXT NOT NULL,
  county_geoid TEXT NOT NULL,
  share       REAL NOT NULL,   -- share of the place's land in that county
  PRIMARY KEY (place_geoid, county_geoid)
);
```

A city in more than one county resolves to the one holding the largest share. The
share is stored so a page can say "most of Austin is in Travis County" rather than
implying the whole of it is.

`countyForPlace()` reads the table. The name heuristic is deleted, and nothing
falls back to it: a wrong county presented as provenance is worse than a panel
that says it has no county figure.

## Acceptance criteria

- [ ] Austin city, Texas resolves to Travis County
- [ ] Nashville-Davidson resolves to Davidson County
- [ ] A city spanning counties resolves to the largest share, and the share is stored
- [ ] A city with no mapping borrows nothing and says so
- [ ] The borrowed-figure note names the right county
- [ ] The name heuristic is gone
- [ ] `verify` fails when a borrowed figure comes from a county the city is not in

## Risks

The relationship file changes between vintages, so the mapping is rebuilt with the
data. A city annexed across a county line moves with it, which is correct.

## Out of scope

County subdivisions, metro boundaries, a map of the overlap.

## Files

`pipeline/schema.sql` · new `pipeline/sources/places.ts` · `pipeline/build.ts` ·
`pipeline/verify.ts` · `server/store.ts` · new `tests/county-map.test.ts`
