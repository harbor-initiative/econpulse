# Three adversarial reviews

Written against `RESEARCH.md`, by three personas, each told to argue against the
rebuild rather than for it. Every point names evidence and ends with a
recommendation. Nothing here is softened for agreement.

---

## Chief Product Officer

**The rebuild shipped a data product and called it a website.**

**1. The front door only works if you already know the postcode.**
The old app answered "how is my town doing" from a city name. The new one takes
a name, a county, or a ZIP, and until yesterday a ZIP produced an error. A
resident does not know their county FIPS and often does not know whether they
live in a city or an unincorporated area.
*Fix: the search index must cover settlement names, not administrative names.
Aliases are the cheapest win in the whole remediation.*

**2. Removing the score removed the only sentence a non-analyst could repeat.**
Five numbers and five receipts is a research tool. "Thriving" is a thing a
person says to a neighbour. The decision to restore it is correct, and it is
also a trap: the old weights (jobs .30, housing .25, gdp .20, population .15,
federal .10) are an editorial opinion published as a measurement.
*Fix: the score ships only with the weights visible in the page, a one-line
methodology, and a rule that the summary may not introduce a number the data
does not contain.*

**3. The differentiator is the smallest text on the page.**
The receipt is 9.5px, grey, at the bottom of each panel. A reader forms an
opinion in five seconds and never scrolls to the thing that makes this product
worth existing.
*Fix: the first receipt on the page must be visually louder than the third
decimal place of the number. One receipt, promoted, teaches the whole idea.*

**4. "Runs offline" is a promise the hosted page does not keep.**
The map needs tiles. The question box needs a model. The claim is true of the
*data artifact*, not of the site, and the site says it in the hero.
*Fix: say "the data runs offline" and link the file. Stop claiming the page does.*

**5. Print-only export is defensible and incomplete.**
A journalist wants a PDF. An analyst wants the numbers, and will now scrape
them instead of downloading them.
*Fix: record the cost, ship print, and put "the data is a file, here it is" in a
prominent place so the analyst's need is met by the artifact rather than the
page.*

**6. No freshness signal is a trust failure.**
The old app showed fresh / aging / stale per source. The new one shows a build
date in 11px mono if you look. A citation with a three-month-old number is worse
than no citation, because it looks current.
*Fix: a freshness strip per panel, driven by `retrieved_at`, and a staleness
warning when a source is more than one release behind.*

**7. A question box that works two times in three teaches people not to use it.**
Observed during testing: the free router returns 429 under load. The failure
mode is a picker, which looks like the box did not understand rather than like
the network was busy.
*Fix: distinguish "I did not understand" from "the model is unavailable", and
say which. Add a model fallback list and a short retry.*

**Verdict:** the rebuild is a better record and a worse product than the thing it
replaced. The remediation is not cosmetic. It restores the four things that made
the old app legible — a verdict, a score, a map, and a search that forgives — and
it should do so without giving up the receipt.

---

## Chief Technology Officer

**The top risk is not a feature. It is that the numbers are frozen.**

**1. The old app was live; the new one is a snapshot.**
`build-dashboard.ts` called five federal APIs per request with a six-hour cache.
The new app reads a SQLite file a maintainer builds. Nothing on the page tells a
reader how old a source is beyond a single build date.
*Fix: per-source age on the page, a `data.age_days` in `/healthz`, and an alert
when any source is more than one release behind. Without this, the trust story is
marketing.*

**2. The best feature has one provider.**
`openrouter/free` is a router, which is better than a single model, but the free
pool rate-limits. Three of six test questions hit 429 on one run.
*Fix: a model list (`models: [...]`) rather than one id, a circuit breaker after
two failures, and a cached last-good answer per question string.*

**3. The model endpoint has no rate limit.**
One key, one box, and a public URL. A script can burn the daily allowance in a
minute. The old app had Redis; we removed Redis by decision, and we still need a
limiter.
*Fix: an in-memory token bucket per IP, 20 questions an hour, and a 429 that
names the reason. No Redis required.*

**4. The web layer has no tests.**
The pipeline has sixteen checks. The server has none. Routing, ZIP resolution,
the question classifier and the panel fallbacks are all untested, and every one
of them has already shipped a bug.
*Fix: `node --test` with fixture requests against a small in-memory database.
Ten tests would have caught the Bell County answer.*

**5. Search is a `LIKE` scan with no ranking.**
`searchPlaces` does `name LIKE '%q%'` ordered by kind then population. It has no
typo tolerance, no prefix boost, and no trigram. "Philadelpia" returns nothing.
*Fix: a trigram column or FTS5, computed at build time. SQLite does this natively
and the old app's suggestion index is the design to copy.*

**6. Autocomplete by network will not survive.**
A round trip per keystroke against 51,158 rows on a single small host is a
predictable latency problem and a needless load.
*Fix: ship a compressed index to the browser, 52k names at roughly 600 KB, and
answer type-ahead locally. The server sees only the final GEOID.*

**7. Removing the 1,000-person filter doubles the file.**
19,142 places becomes 35,605, roughly 110 MB to 160 MB, and the build from about
150 seconds to about 240. That is affordable; it should be measured, not assumed.
*Fix: measure before and after in the same session and record both numbers in the
spec.*

**8. Every data update requires an image rebuild.**
The database is baked into the image. Refreshing data means build, push, restart.
The old app refreshed data without a deploy.
*Fix: mount the database as a volume with a documented replace step, and keep
baking as the default for anyone who wants one artifact.*

**9. `/healthz` answers "did the process start", not "is the data any good".**
*Fix: return the data version, the age of the newest fact, and the age of the
oldest, and let the monitor alert on the second.*

**Verdict:** the pipeline is stronger than the old one and the serving layer is
weaker. The remediation should spend its first week on freshness, tests and rate
limiting, not on the map.

---

## Chief Design Officer

**1. The page is handsome and says nothing about itself.**
No line anywhere explains why this page is different from any other local data
page. The receipt is the answer and it is set as fine print.
*Fix: one promoted receipt above the fold, and a single sentence under the
headline that names the promise.*

**2. There is no place for a score.**
Adding a 0–100 and a label to a five-panel grid changes the whole hierarchy. The
current layout has no slot for it, and bolting it into the header will look like
an afterthought.
*Fix: a header block — place name, label, score, one-line summary — with the
panels below as evidence. The page reads top-down as claim then proof.*

**3. The map will fight the charts.**
A full-width map above five panels steals the first screen from the numbers and
duplicates the breadcrumb.
*Fix: a 200px locator beside the header, not a hero. It answers "where", then
gets out of the way.*

**4. A three-to-five second model call has no loading state.**
The browser waits on a blank page. That is the worst possible feedback.
*Fix: render the shell immediately with the question echoed and a progress line
that names the step — "reading the question", "finding the place", "pulling the
number".*

**5. There is no error state for a model failure.**
The picker appears, indistinguishable from "I did not understand you".
*Fix: two distinct cards. "I could not reach the model, here is the picker" and
"Which place did you mean?" are different sentences.*

**6. The print stylesheet does not exist.**
Print is now the only export and it is unbuilt.
*Fix: one column, panels unbroken, receipts included, URL and data version in the
footer. Test by printing to PDF, not by reading the CSS.*

**7. Charts have no accessible alternative.**
The SVGs are `aria-hidden` with no table. The design doc promised a table toggle
and it was never built.
*Fix: a `<details>` table under each chart. It is also the answer for anyone who
wants the numbers without hovering.*

**8. Long place names break the headline.**
"Prince George's County, Maryland" at 2.2rem wraps on a phone into three lines
above the first number.
*Fix: a smaller clamp with a two-line maximum and the state moved to the
breadcrumb.*

**9. The home page has no proof.**
Nothing shows what an answer looks like. The old app had a working example above
the fold.
*Fix: one rendered example card, real numbers, real receipt, under the box.*

**Verdict:** the visual system is right and the page is unfinished. The header
block, the promoted receipt, the loading states and the print sheet are the
difference between a demo and a product.

---

## What the three reviews agree on

1. **The score needs a header block**, and the summary must be grounded.
2. **The receipt must be promoted** from fine print to a feature.
3. **Freshness is a trust feature**, not a nice-to-have, and it is missing.
4. **The question box needs loading, error and rate-limit states** before it can
   be depended on.
5. **Search forgiveness** — aliases, typo tolerance, local autocomplete — matters
   more than any single new panel.
