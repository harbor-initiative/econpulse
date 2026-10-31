/**
 * How old a number is, and when to say so out loud.
 *
 * The thresholds live here and nowhere else, so the page and `/healthz` cannot
 * disagree about whether the file is stale. That is the whole reason this is a
 * module rather than two constants in a view.
 *
 * Staleness describes the file, not the country: one source can be old while the
 * rest are current, which is why the signal is per panel and not a banner.
 */

import type { DatabaseSync } from "node:sqlite";

/** Days since retrieval at which a panel changes how it presents itself. */
export const FRESHNESS = { agingAfterDays: 35, staleAfterDays: 120 } as const;

export type FreshnessBand = "fresh" | "aging" | "stale";

const DAY_MS = 86_400_000;

/**
 * The clock, with one override.
 *
 * `/healthz` and `/status` print an age in days, which means their rendered HTML
 * changes every day and the snapshot gate would fail every morning for a reason
 * that is not a regression. `ECONPULSE_NOW` pins the clock for the snapshot run;
 * the product never sets it.
 */
export function now(): Date {
  const pinned = process.env.ECONPULSE_NOW;
  if (pinned) {
    const parsed = new Date(pinned);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Whole days between a retrieval date and now.
 *
 * A retrieval date in the future clamps to zero. The build date and the machine
 * clock disagree often enough that a negative age would otherwise render as
 * "-1 days ago" on a page a reader is meant to trust.
 */
export function ageInDays(retrievedAt: string, at: Date = now()): number {
  const then = Date.parse(`${retrievedAt}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((at.getTime() - then) / DAY_MS));
}

export function bandFor(ageDays: number): FreshnessBand {
  if (ageDays > FRESHNESS.staleAfterDays) return "stale";
  if (ageDays >= FRESHNESS.agingAfterDays) return "aging";
  return "fresh";
}

export function bandOf(retrievedAt: string, at: Date = now()): FreshnessBand {
  return bandFor(ageInDays(retrievedAt, at));
}

export interface DateSpan {
  oldest: string | null;
  newest: string | null;
}

/** The oldest and newest retrieval dates in the file, for the header block. */
export function factDateSpan(db: DatabaseSync): DateSpan {
  const row = db.prepare("SELECT MIN(retrieved_at) AS oldest, MAX(retrieved_at) AS newest FROM fact").get() as
    | { oldest: string | null; newest: string | null }
    | undefined;
  return { oldest: row?.oldest ?? null, newest: row?.newest ?? null };
}

/** The file's band, for `/healthz` and for the status page. */
export function spanBand(span: DateSpan, at: Date = now()): FreshnessBand {
  if (!span.newest) return "fresh";
  return bandOf(span.newest, at);
}

/** An age said out loud. A page that prints "0 days old" reads like a machine. */
export function ageWords(ageDays: number): string {
  if (ageDays <= 0) return "today";
  if (ageDays === 1) return "yesterday";
  return `${ageDays} days ago`;
}

/**
 * The end of a period as a date, so periods in different shapes compare.
 *
 * `FY2026` ends 2026-09-30 and `2026-09` ends in September, so a plain string
 * MAX would rank the fiscal year above the weekly series. The `-31` for a month
 * is a sort key, not a date claim.
 */
function periodEnd(period: string): string {
  const fiscal = /^FY(\d{4})$/.exec(period);
  if (fiscal) return `${fiscal[1]}-09-30`;
  const range = /^(\d{4})-(\d{4})$/.exec(period);
  if (range) return `${range[2]}-12-31`;
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) return `${month[1]}-${month[2]}-31`;
  const year = /^\d{4}$/.exec(period);
  if (year) return `${period}-12-31`;
  return period;
}

/** One agency's slice of the file, with the dates that make it citable. */
export interface AgencyFacts {
  agency: string;
  facts: number;
  oldestRetrieval: string;
  newestRetrieval: string;
  oldestPeriod: string;
  newestPeriod: string;
}

/** What the file holds, read once. Both answers use this one shape. */
export interface FileFacts {
  facts: number;
  oldestRetrieval: string | null;
  newestRetrieval: string | null;
  oldestPeriod: string | null;
  newestPeriod: string | null;
  agencies: AgencyFacts[];
}

interface PeriodRow {
  agency: string;
  period: string;
  facts: number;
  oldest_retrieval: string;
  newest_retrieval: string;
}

/**
 * The published file is replaced and the server restarts on a refresh, so one
 * read per open connection is as fresh as the handle itself. It is cached
 * because the shipped schema indexes neither `agency` nor `retrieved_at`: the
 * grouping measured 125 ms on the open file, which is a load source once a
 * monitor polls it. An index in the pipeline would make the cache unnecessary.
 */
const factCache = new WeakMap<DatabaseSync, FileFacts>();

export function fileFacts(db: DatabaseSync): FileFacts {
  const cached = factCache.get(db);
  if (cached) return cached;

  const rows = db
    .prepare(
      `SELECT agency, period, COUNT(*) AS facts,
              MIN(retrieved_at) AS oldest_retrieval, MAX(retrieved_at) AS newest_retrieval
       FROM fact GROUP BY agency, period ORDER BY agency, period`,
    )
    .all() as unknown as PeriodRow[];

  const agencies = new Map<string, AgencyFacts>();
  let facts = 0;
  for (const row of rows) {
    facts += row.facts;
    const found = agencies.get(row.agency);
    if (!found) {
      agencies.set(row.agency, {
        agency: row.agency,
        facts: row.facts,
        oldestRetrieval: row.oldest_retrieval,
        newestRetrieval: row.newest_retrieval,
        oldestPeriod: row.period,
        newestPeriod: row.period,
      });
      continue;
    }
    found.facts += row.facts;
    if (row.oldest_retrieval < found.oldestRetrieval) found.oldestRetrieval = row.oldest_retrieval;
    if (row.newest_retrieval > found.newestRetrieval) found.newestRetrieval = row.newest_retrieval;
    if (periodEnd(row.period) < periodEnd(found.oldestPeriod)) found.oldestPeriod = row.period;
    if (periodEnd(row.period) > periodEnd(found.newestPeriod)) found.newestPeriod = row.period;
  }

  const list = [...agencies.values()].sort((a, b) => b.facts - a.facts || a.agency.localeCompare(b.agency));
  const newestPeriod = list.reduce<string | null>(
    (best, agency) => (best === null || periodEnd(agency.newestPeriod) > periodEnd(best) ? agency.newestPeriod : best),
    null,
  );
  const oldestPeriod = list.reduce<string | null>(
    (best, agency) => (best === null || periodEnd(agency.oldestPeriod) < periodEnd(best) ? agency.oldestPeriod : best),
    null,
  );
  const result: FileFacts = {
    facts,
    oldestRetrieval: list.reduce<string | null>((best, agency) => (best === null || agency.oldestRetrieval < best ? agency.oldestRetrieval : best), null),
    newestRetrieval: list.reduce<string | null>((best, agency) => (best === null || agency.newestRetrieval > best ? agency.newestRetrieval : best), null),
    oldestPeriod,
    newestPeriod,
    agencies: list,
  };
  factCache.set(db, result);
  return result;
}
