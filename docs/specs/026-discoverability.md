# #26 — Discoverability: JSON-LD, sitemap, canonicals

Parent: #4 · Epic spec: [04-trust-and-reach](../remediation/specs/04-trust-and-reach.md) · Status: draft

## Problem

No sitemap, no structured data, no canonical tags. The old app had all three and
100 pre-rendered metro pages. Search is the only channel this product has that is
not a screenshot on social.

## Approach

- **JSON-LD** per place page: `Place`, `Dataset`, `BreadcrumbList`.
  **No `AggregateRating`** — a place is not a business and a score of a county is
  not a review.
- **Sitemap index** over 52 state files, because 51,158 URLs in one file is
  unwieldy for a crawler and for us.
- **One canonical host.** `econpulse.harborgovcon.com` is canonical.
  `econpulse.porbanderwala.cloud` returns a 301 to the same path on the canonical
  host, added as one line in its Caddy block, and the link on
  `porbanderwala.cloud` is updated to point at the new host.
- **Meta description** per place, generated from the name, state and score,
  cached with the summary.

## Acceptance criteria

- [ ] JSON-LD validates with a structured-data validator
- [ ] `/sitemap.xml` is an index; every child resolves and every URL returns 200
- [ ] Every page carries its own absolute canonical on the canonical host
- [ ] `econpulse.porbanderwala.cloud/p/42101` 301s to the harborgovcon path
- [ ] `porbanderwala.cloud` links to the canonical host
- [ ] `robots.txt` points at the index and sets a crawl delay
- [ ] No page claims an aggregate rating

### What changed while building it

- **The old host redirects.** `econpulse.porbanderwala.cloud` returned 200 on the
  same container, which gives two addresses for every page. It now answers
  `301 https://econpulse.harborgovcon.com{uri}` from its own Caddy block, verified
  live before this PR opened.
- **`/method` is not in the sitemap yet.** The page is #25. A sitemap that lists a
  404 is worse than a sitemap that lists two pages.
- **The sitemap is built at request time and cached**, because a sitemap written
  at build time describes the file the build had. #8 is about to add 13,000 places
  and the sitemap should follow without a second change.
- **`shell()` takes an options object.** A sixth positional argument for
  `canonical` was the point at which the signature stopped being readable.

## Risks

51,158 URLs invite crawler load on a small box. Crawl delay plus a state split
keeps it polite; the sitemap is generated once per build.

## Out of scope

Search-console verification, RSS, Open Graph images.

## Files

new `server/lib/structured.ts` · new `server/lib/site.ts` · new `server/lib/sitemap.ts` · `server/routes/assets.ts` · `server/views/layout.ts` · `server/views/report.ts` · `server/views/home.ts` · `server/views/status.ts` · `server/views/search.ts` · `server/views/ask.ts` · new `tests/structured.test.ts`