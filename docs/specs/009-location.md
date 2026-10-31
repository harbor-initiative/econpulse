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
- [ ] A coordinate outside the US returns the not-found state
- [ ] No coordinate is logged or stored

### What changed while building it

**No geocoder.** The boundaries the map already draws are the index, so the
answer is a point-in-polygon test against our own files. A third-party geocoder
would have been one line and one more dependency that can be down, rate-limited,
or wrong in a way we cannot see.

**Parsed on first use, not at boot.** Sixteen megabytes of GeoJSON is a lot to
parse for an endpoint most readers never call. The shapes load when the first
`/api/where` request arrives, and stay.

**A city wins over its county.** Philadelphia city and Philadelphia County share
a boundary; a reader standing in one expects the city.

**A vertex is not guaranteed.** Ray casting excludes a point that lands exactly
on a corner of a ring. A GPS fix does not, and the test records the behaviour
rather than pretending it does not exist.

## Risks

Precision theatre: the browser may return a coarse fix from Wi-Fi, which can put
someone in the next county. The page says "based on your approximate location"
and links to the search box.

## Out of scope

Street-address geocoding, routing, IP-based lookup.

## Files

new `server/routes/geo.ts` · `server/app.ts` · new `public/location.js` · new `pipeline/sources/boundaries.ts` (shared with #16)