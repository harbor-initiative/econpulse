# #6 — Fuzzy search index with typo tolerance

Parent: #1 · Epic spec: [01-finding-a-place](../remediation/specs/01-finding-a-place.md) · Status: draft

## Problem

`searchPlaces` is `name LIKE '%q%'` ordered by kind then population. No prefix
boost, no typo tolerance, no trigram. "Philadelpia" returns nothing. Every
keystroke is a scan of 51,158 rows, which will not survive autocomplete.

## Approach

Load the index once at boot into a `Map`, roughly 4 MB for 52,000 entries, and
answer from memory.

```ts
interface IndexEntry {
  geoid: string; name: string; norm: string; kind: string;
  stateCode: string | null; population: number | null;
}
```

`norm` = lowercased, punctuation stripped, `city|town|village|borough|cdp`
suffix removed. "County" is kept because it is a real distinction.

Ranking, first match wins:

1. exact alias (issue #5)
2. exact `norm`
3. prefix on `norm`
4. trigram overlap ≥ 0.6, tie-broken by population
5. substring

Trigrams are computed at boot. 52,000 × ~20 trigrams is a few MB and
one pass; storing them in SQLite costs a schema migration for no gain.

Ties are broken by population, and that is a stated editorial choice: a search
for "Springfield" means the one most people mean.

## Acceptance criteria

- [ ] `Philadelpia` resolves to Philadelphia County
- [ ] `Pittsburg` resolves to Pittsburgh
- [ ] A three-character query returns in under 5 ms warm
- [ ] Ranking is deterministic and covered by a fixture test
- [ ] Boot time increases by under 150 ms

## Risks

Memory on a small box. Measured at boot and logged; if it exceeds 8 MB the
trigram sets are dropped and step 4 degrades to a Levenshtein window.

## Out of scope

Stemming, phonetics, non-Latin scripts.

## Files

new `server/lib/search-index.ts` · `server/store.ts` · `server/routes/home.ts` · new `tests/search.test.ts`