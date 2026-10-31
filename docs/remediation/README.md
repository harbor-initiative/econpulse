# Remediation

The rebuild replaced a working product with a better dataset. This directory is
the plan for closing that gap without giving up the dataset.

Order of work, and it is deliberate:

1. **Research** (`RESEARCH.md`) — every old capability, with the file that held it.
2. **Reviews** (`REVIEWS.md`) — CPO, CTO and CDO arguing against the rebuild.
3. **Specifications** (`specs/`) — four, each codebase-aware, each with
   acceptance criteria.
4. **Issues** — filed from these specs, never before them.

A specification is committed and pushed before its issue exists. An issue is a
pointer to a spec, not a replacement for one.

## Decisions taken

Interview on 2026-10-30, recorded here because they bound every spec.

| # | Decision | Reverses |
|---|---|---|
| 1 | Reading experience only. No accounts, billing, Redis or admin cache. | — |
| 2 | Every place is findable. The 1,000-person filter comes off. | Loader default |
| 3 | The model leads on questions. Grammar is a fallback for names. | Earlier "grammar first" design |
| 4 | The score returns, with weights shown, plus an AI summary. | The no-verdict rule |
| 5 | Map is MapLibre with OpenFreeMap tiles, keyless. | "No map" in the design doc |
| 6 | Print is the only export. | — |

## The specs

| Spec | Epic | Feature issues |
|---|---|---|
| [01 — Finding a place](specs/01-finding-a-place.md) | #1 | #5 aliases · #6 fuzzy index · #7 autocomplete · #8 full coverage · #9 location |
| [02 — The report](specs/02-the-report.md) | #2 | #10 score and weights · #11 percentiles · #12 AI summary · #13 freshness · #14 benchmarks · #15 quick facts · #16 map · #17 print · #18 chart tables |
| [03 — The question box](specs/03-the-question-box.md) | #3 | #19 model reliability · #20 rate limit · #21 six states · #22 progressive loading · #23 comparison |
| [04 — Trust and reach](specs/04-trust-and-reach.md) | #4 | #24 health and status · #25 method · #26 discoverability · #27 refresh · #28 staleness |

Twenty-four feature issues, one per deliverable, each linking its parent epic and
its spec section. The three P0 clusters are #1, #2 and #3.

## What is deliberately not here

Google sign-in, Stripe, saved places, saved reports, email alerts, the onboarding
tour, Redis rate limiting, Umami, admin cache warming, CSV and JSON export, share
images, and the full Leaflet stack with OSM tiles.

Each is recorded in `RESEARCH.md` under "out of scope by decision" so that nobody
re-opens one by accident and assumes it was forgotten.

## How the work is sequenced

1. **Spec 1** first. Nothing else matters if a person cannot find their town.
2. **Spec 3** second, because the box is already live and its missing states are
   the most visible defect.
3. **Spec 2** third. It is the largest and depends on the percentile pass.
4. **Spec 4** last. Reach only matters once there is something worth reaching.

Spec 2's freshness section and Spec 4's `/healthz` should ship together; a stale
number that looks current is the single largest trust risk in this product.
