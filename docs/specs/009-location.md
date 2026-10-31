# #9 — Use my location

Parent: #1 · Epic spec: [01-finding-a-place](../remediation/specs/01-finding-a-place.md) · Status: draft

## Problem

The old app resolved a browser location to a place. The rebuild has no way to do
that, and a ZIP is a worse answer than the county you are standing in.

## Approach

`navigator.geolocation` → `GET /api/here?lat=&lon=` → point-in-polygon against
county boundaries → the county's place row.

Depends on #16 for the boundary data. That is why this is P2: the map work has to
land first, and the boundary file is the same file.

Permission denial is not an error. It falls back to the search box with the
placeholder unchanged, no dialog and no explanation.

## Acceptance criteria

- [ ] A coordinate resolves to the containing county
- [ ] Denial silently falls back to search
- [ ] A coordinate outside the US returns the not-found state, not a wrong county
- [ ] No coordinate is logged or stored

## Risks

Precision theatre: the browser may return a coarse fix from Wi-Fi, which can put
someone in the next county. The page says "based on your approximate location"
and links to the search box.

## Out of scope

Street-address geocoding, routing, IP-based lookup.

## Files

`server/index.ts` · new `server/geo.ts` · `public/location.js` ·
`pipeline/sources/boundaries.ts` (shared with #16)
