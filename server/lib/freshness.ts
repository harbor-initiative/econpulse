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
 * Whole days between a retrieval date and now.
 *
 * A retrieval date in the future clamps to zero. The build date and the machine
 * clock disagree often enough that a negative age would otherwise render as
 * "-1 days ago" on a page a reader is meant to trust.
 */
export function ageInDays(retrievedAt: string, now: Date = new Date()): number {
  const then = Date.parse(`${retrievedAt}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

export function bandFor(ageDays: number): FreshnessBand {
  if (ageDays > FRESHNESS.staleAfterDays) return "stale";
  if (ageDays >= FRESHNESS.agingAfterDays) return "aging";
  return "fresh";
}

export function bandOf(retrievedAt: string, now: Date = new Date()): FreshnessBand {
  return bandFor(ageInDays(retrievedAt, now));
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
export function spanBand(span: DateSpan, now: Date = new Date()): FreshnessBand {
  if (!span.newest) return "fresh";
  return bandOf(span.newest, now);
}
