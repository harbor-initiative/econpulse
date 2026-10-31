# Spec 4 — Trust and reach

Status: draft · Owner: unassigned · Depends on: Spec 2 (data version surfaced)
Decision source: interview 2026-10-30, decision 1 (no accounts, no analytics) and
the CTO review's first finding.

## Problem

The rebuild is a snapshot served by a process that cannot tell you whether the
snapshot is any good.

- `/healthz` returns `{ok, data}`, which answers "did the process start". It does
  not answer "is the file current".
- A refresh means rebuild, push, restart. The old app refreshed with a request.
- Nothing tells a search engine the pages exist. The old app had `sitemap.ts`,
  `jsonld.ts` and 100 pre-rendered metro pages.
- There is no page explaining where the numbers come from or how the score is
  computed. The old app had `/about`.
- There is no `Place` or `Dataset` structured data, so a result in a search
  engine cannot say what it is.

## Decision

- No analytics by decision. Reach comes from structured data and a sitemap, not
  from tracking.
- No accounts, so no per-user freshness. Freshness is a property of the file.
- The data artifact is the primary product; the site is its demonstration.

## Design

### 1. `/healthz` answers about the data

```json
{
  "ok": true,
  "data": "2026.10",
  "built_at": "2026-10-31T00:03:55Z",
  "facts": 321295,
  "newest_fact": "2026-09",
  "oldest_retrieval": "2026-10-30",
  "stale_sources": []
}
```

A monitor alerts on `stale_sources` being non-empty and on `built_at` being more
than 45 days old. The process being up is the least interesting thing about it.

### 2. `/status` becomes a real page

Today it lists build metadata. It should list, per agency: last retrieval date,
fact count, oldest period covered, and a fresh / aging / stale badge using the
same thresholds as the report.

### 3. `/method`

One page, plain English, linked from the score and the footer. It covers:

- Which five agencies, which datasets, and what each measures.
- Why the ACS five-year average differs from the monthly BLS rate, and why both
  appear.
- How the score is built, with the weights and the percentile method.
- What the score is not: not a prediction, not financial advice, not a ranking of
  places by worth.
- How to cite the page: app version, data version, retrieval date.

This page is the answer to "why should I trust this", and there is currently no
such answer anywhere on the site.

### 4. Structured data

On every place page, JSON-LD with:

- `Place`, name, containedInPlace, geo if the boundary work provides a centroid.
- `Dataset`, name, description, temporalCoverage from the facts, `creator` as
  HARBOR Initiative, `license` as the public-domain status of the sources.
- `BreadcrumbList` for place → county → state.

No `AggregateRating`. A score of a place is not a review of a business and must
not be marked up as one.

### 5. Sitemap and canonicals

- `/sitemap.xml` listing the home page, `/method`, `/status`, and every place
  page. 51,158 URLs is too many for one file; split by state, 52 files, with an
  index.
- Canonical on every page pointing at itself, absolute.
- Meta description per place: the place name, the state, and the score, generated
  from the data and cached with the summary.

### 6. Refresh without a rebuild

Add a documented path for updating the data without rebuilding the image:

```bash
# on the host
curl -sSL -o econpulse.db.gz <release asset>
gunzip -c econpulse.db.gz > /srv/econpulse/econpulse.db.new
mv /srv/econpulse/econpulse.db.new /srv/econpulse/econpulse.db
docker restart econpulse
```

Requires the container to mount `/srv/econpulse` and `ECONPULSE_DB` to point
inside it. Baking the file stays the default for anyone who wants one artifact;
the mount is documented for the box that serves the site.

The server must tolerate a replaced file: it opens read-only at boot, so a
restart is required and that is acceptable. A future version could watch the
inode, and does not need to now.

### 7. A staleness alert

A weekly job that compares `built_at` to today and opens an issue titled
"Data is N days old" when N exceeds 45. Cheap, visible, and it fails toward
somebody noticing.

## Acceptance criteria

1. `/healthz` returns the fields above and the values are true.
2. `/status` shows per-agency freshness with the same badges as the report.
3. `/method` exists, is linked from the score and the footer, and states the
   weights.
4. Every place page emits valid `Place`, `Dataset` and `BreadcrumbList` JSON-LD,
   verified with a structured-data validator.
5. `/sitemap.xml` is an index over 52 state files; every URL returns 200.
6. Every page has a self-referential absolute canonical.
7. The data can be replaced on the host without rebuilding the image, per the
   documented steps.
8. A 46-day-old build opens the staleness issue.

## Risks

- **51,158 sitemap URLs** invites crawler load on a small box. State-split files
  and a `crawl-delay` in robots.txt keep it polite.
- **Structured data drift.** If the score changes meaning, the JSON-LD must not
  claim an aggregate rating. Enforcement is the validator in CI.
- **Mount plus bake is two paths.** Two paths means one rots. The mount is the
  production path and the bake is the demo path; both are tested in the deploy
  runbook.

## Out of scope

Analytics, search-console verification, RSS, Open Graph images (cut by decision),
and any server-side rendering of pages we do not already render.

## Files touched

`server/index.ts` (routes, canonicals, JSON-LD), `server/view.ts`,
new `server/structured.ts`, new `server/sitemap.ts`, new `server/method.ts`,
`deploy/README.md`, new `.github/workflows/staleness.yml`.
