# Research: what the old EconPulse did, and what this rebuild does not

Written 2026-10-31. Every claim here comes from reading the code.

- Old app: `aporb/EconPulse`, now archived. Cloned at `_repo/`, last commit `c465fd8` on 2026-09-05.
- New app: `harbor-initiative/econpulse`, live at `econpulse.harborgovcon.com`.
- Method: full tree read of `src/app` (23 routes), `src/components` (33 files), `src/lib` (41 modules).

## Decisions taken before this document

From the scoping interview on 2026-10-30. These bound every specification that follows.

| # | Decision | Consequence |
|---|---|---|
| 1 | **Reading experience only.** No accounts, no billing, no Redis, no admin cache. | Sixteen old capabilities are out of scope by decision. |
| 2 | **Every place is findable.** All 32,330 incorporated places, 3,222 counties, 33,486 ZIPs, 52 states. | The 1,000-person filter comes off. File grows to roughly 160 MB. |
| 3 | **The model leads on questions.** Grammar is the fallback. | A question needs a key. Without one the box degrades to the picker. |
| 4 | **Score returns, with weights shown**, plus an AI-written summary grounded in the pillars. | Reverses the no-verdict rule in the design doc. The weights must be visible on the page. |
| 5 | **Map is MapLibre with OpenFreeMap tiles**, keyless, degrading to an outline offline. | No tile server to run. External network for the map only. |
| 6 | **Print is the only export.** | No CSV, no JSON, no share image. The print stylesheet carries the citation. |

## What the rebuild already has

The old app never had these. The remediation must keep all of it working.

| Capability | Where |
|---|---|
| A receipt on every value: agency, dataset, table, vintage, retrieval date, margin | `pipeline/schema.sql`, `fact` table |
| The data as a downloadable artifact, 9.4 MB gzipped with a checksum | Release `v0.1.0-data` |
| A verification gate, 16 checks including ZIP coverage and pinned numbers | `pipeline/verify.ts` |
| Five agencies in one file | `pipeline/sources/{census,bls,bea,usaspending,fred}.ts` |
| MCP server, seven read-only tools | `server/mcp.ts` |
| Question box that names a place and a measure | `server/ask.ts` |
| No Postgres, Redis, Stripe or NextAuth needed to boot | `server/store.ts` opens the file read-only |
| Status page naming the data version and build date | `server/view.ts` |

## The gap, by cluster

### Cluster 1 — Finding a place

| Capability | Old | New | Evidence in the old app |
|---|---|---|---|
| Name search | ✅ | ✅ | `geography/resolver.ts` |
| ZIP search | ✅ | ✅ | Just shipped: `zcta` table, 33,486 rows |
| Type-ahead suggestions | ✅ | — | `search/suggestion-index.ts`, `/api/suggest` |
| 101 curated metros, instant | ✅ | — | `data/top-metros.ts`, exactly 101 entries |
| "Use my location" | ✅ | — | `geography/reverse-geocode.ts`, `/api/reverse-geocode` |
| Nearby places | ✅ | — | `regions/nearby-locator.ts`, TIGER queries |
| Metro context | ✅ | — | `regions/metro-lookup.ts` |
| Small places under 1,000 | ✅ | — | Loader filter, deliberate |
| Nicknames ("Philly", "NYC") | — | — | Neither app had this |

**The failure the user hit:** typing `20744` returned "I need a place to answer that", because ZIPs were never loaded. Fixed. Typing a ZIP now resolves to its county with a strip that says so.

### Cluster 2 — The report

| Capability | Old | New | Evidence |
|---|---|---|---|
| Five pillars | ✅ | ✅ | `types.ts`: `gdp`, `jobs`, `population`, `housing`, `federal_funds` |
| Composite score 0–100 | ✅ | — | `scoring/score.ts`, weights jobs .30 / housing .25 / gdp .20 / population .15 / federal .10 |
| Status label | ✅ | — | `overallStatusFromScore`: ≥67 Thriving, ≥34 Stable, else Strained |
| Rent burden and affordability band | ✅ | — | `affordabilityBand`, `scoreAffordability` |
| State and US benchmark per metric | ✅ | partial | `compareMetric`; new app compares on two panels only |
| Quick facts grid | ✅ | — | `build-dashboard.ts` lines 180+, ten secondary values |
| Freshness badge | ✅ | — | `freshness.ts`: fresh / aging / stale / unknown by age in days |
| Partial-data warnings on the page | ✅ | — | `warnings[]` collected per source |
| HUD fair market rents, 1BR and 2BR | ✅ | — | `data-sources/hud.ts`, county then MSA then ZIP fallback |
| FRED macro context | ✅ | ✅ | New app uses CPI and mortgage rate instead |
| Charts | ✅ | partial | Old: Recharts area, bar, line. New: line and bar only |
| Map with boundaries | ✅ | — | `maps/leaflet-client.tsx`, `maps/geojson-cache.ts` |
| Pre-warmed cache, top 100 metros | ✅ | — | `dashboard/cache.ts`, `/api/admin/warm-cache` |

### Cluster 3 — The question box

The old app had **no question box at all**. It had a location search. This cluster is new work, and the only requirements are the ones the interview set.

| Behaviour | Today | Decision |
|---|---|---|
| "Philadelphia" | index | stays |
| "rent in Austin" | grammar | stays |
| "Is rent up in Austin?" | model, then index | model leads |
| "…where the Liberty Bell is" | was Bell County, Texas | fixed: model names Philadelphia |
| Comparison, "Austin vs Nashville" | not supported | **not specified yet** |
| No key configured | picker | acceptable |

### Cluster 4 — Reach

| Capability | Old | New | Evidence |
|---|---|---|---|
| Sitemap | ✅ | — | `app/sitemap.ts` |
| robots.txt | ✅ | ✅ | `server/index.ts` |
| JSON-LD, schema.org Place and Dataset | ✅ | — | `seo/jsonld.ts` |
| Static pages per metro | ✅ | — | `location/[state]/[county]/page.tsx`, 100 pre-rendered at build |
| Share card / OG image | ✅ | — | `/api/og` |
| Analytics | ✅ | — | Umami, `analytics/umami.ts` |

## Out of scope by decision

These existed and are not coming back. Recorded so nobody re-opens them by accident.

Google sign-in and NextAuth · Stripe checkout, webhooks, tiers and the paywall · saved locations · saved reports · email alerts and digests · onboarding tour · Redis rate limiting · Umami analytics · admin cache warming · CSV/JSON/share-image export · full Leaflet with OSM tiles.

## The one thing this document cannot settle

The old app's numbers **updated themselves on request**, by calling five federal APIs per dashboard and caching the result for six hours. The new app reads a file built by a maintainer. A page can therefore be days old while looking current.

That is the largest behavioural difference between the two products, and neither the interview nor the specs so far address it. It is raised in the CTO review as the top risk.
