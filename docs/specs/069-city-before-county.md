# #69 — Typing a city name returns its county

Parent: none · Status: draft · Found in: manual testing after #7

## Problem

`searchPlaces(db, "Austin")` returns Travis County, Texas. It should answer with
Austin city, Texas.

| Typed | Returned | Expected |
|---|---|---|
| Austin | Travis County, TX | Austin city, TX |
| Nashville | Davidson County, TN | Nashville-Davidson, TN |
| Seattle | King County, WA | Seattle city, WA |
| Pittsburgh | Allegheny County, PA | Pittsburgh city, PA |

## Cause

#5 added 100 metro aliases, one per metro, pointing at the principal county:
`austin,48453,metro`. `searchPlaces` tries exact name, then alias, then fuzzy.

The exact tier compares `name` and `short_name`. A city's `short_name` carries
its type suffix — `Austin city` — so the query `Austin` matches nothing exactly,
falls through to the alias tier, and the alias is a county.

Measured on the released file, the fuzzy tier never runs for these names: the
alias answers first.

## Approach

An exact match also covers the base name: `short_name` with the trailing type
word removed. `Austin city` yields `Austin`, which equals the query, so the exact
tier answers before the alias tier is consulted.

The precedence stays as #5 defined it. What changes is what counts as exact.

Several places can share a base name. Austin, Texas; Austin, Minnesota; Austin
County, Texas. The result is a short list, the picker appears, and the reader
chooses. That is the answer an ambiguous name deserves, and it is what the
Springfield case already does.

A metro name with no city of that name — Bay Area, DMV, Twin Cities — still
resolves through the alias, because no place is named that.

## Acceptance criteria

- [ ] `Austin` offers Austin city, Texas among its results
- [ ] `Nashville` offers Nashville-Davidson
- [ ] `Springfield` still returns a list of cities
- [ ] A metro-only alias such as `Bay Area` still resolves
- [ ] Three-character queries stay under 5 ms
- [ ] A test asserts the base-name match does not displace an exact full-name match

## Risks

A state name is also a base name: `Washington` matches Washington County in
thirty states, Washington city, and the state. The picker handles it, and the
kind ordering puts states after counties today. That ordering is worth a second
look in #10, which is where a reader lands on the right page in one click.

## Out of scope

Ranking by a popularity signal, a curated city-over-county preference list (the
base-name rule removes the need for one), and typo tolerance, which #6 owns.

## Files

`server/store.ts` · new `tests/search-order.test.ts`
