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

| Spec | Covers | Issue |
|---|---|---|
| [01 — Finding a place](specs/01-finding-a-place.md) | Alias table, fuzzy index, autocomplete, full place coverage, use-my-location | #1 |
| [02 — The report](specs/02-the-report.md) | Score and weights, AI summary, freshness, benchmarks, quick facts, map, print, tables | #2 |
| [03 — The question box](specs/03-the-question-box.md) | Model contract, fallbacks, rate limit, six states, comparison | #3 |
| [04 — Trust and reach](specs/04-trust-and-reach.md) | `/healthz`, `/status`, `/method`, JSON-LD, sitemap, refresh without rebuild | #4 |

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
