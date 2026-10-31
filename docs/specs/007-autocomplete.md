# #7 — Autocomplete endpoint and accessible combobox

Parent: #1 · Epic spec: [01-finding-a-place](../remediation/specs/01-finding-a-place.md) · Status: draft

## Problem

There is no type-ahead. A person types a full name and presses Enter, or nothing
happens. The old app had `/api/suggest` and a 101-entry metro index.

## Approach

`GET /api/suggest?q=` returns up to 10 ranked entries from issue #6:

```json
{ "suggestions": [{ "geoid": "42101", "name": "Philadelphia County, Pennsylvania",
                    "kind": "county", "stateCode": "PA", "population": 1579706 }] }
```

Client: a combobox. The native `<datalist>` cannot show kind or population, and both matter because "Philadelphia city" and "Philadelphia County"
are different answers.

The combobox carries `role="combobox"`, `aria-expanded`, `aria-activedescendant`,
arrow keys, Enter, Escape and a 120 ms debounce.

## Acceptance criteria

- [ ] Three characters return suggestions in under 100 ms server-side
- [ ] Each row shows name, state, kind and population
- [ ] Arrow keys move, Enter opens, Escape closes and restores the query
- [ ] The active option is announced to a screen reader
- [ ] With JavaScript off the form still submits and resolves

## Risks

A request per keystroke on one small host. Debounce plus a 60-second HTTP cache
keeps it cheap; the client-side index is a later optimisation.

## Out of scope

Client-side index, search history, recent places.

## Files

`server/index.ts` · new `public/combobox.js` · `server/view.ts` ·
new `tests/suggest.test.ts`
