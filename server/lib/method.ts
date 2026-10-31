/**
 * The agency table on the method page, read from the file it describes.
 *
 * A hand-written list of sources drifts the moment a loader changes. This is a
 * query, so a new agency appears on the page the day it appears in the data.
 */

import type { DatabaseSync } from "node:sqlite";
import { METRICS, METRIC_LABELS } from "./metrics.ts";

export interface AgencySummary {
  agency: string;
  measures: string[];
  periodRange: string;
  facts: number;
  retrieved: string;
}

function labelFor(metric: string): string {
  return METRICS[metric]?.label ?? METRIC_LABELS[metric] ?? metric;
}

/** A loader that normalises a month to a date should not print the date. */
function shortPeriod(period: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(period) ? period.slice(0, 7) : period;
}

export function agencySummary(db: DatabaseSync): AgencySummary[] {
  const rows = db
    .prepare(
      `SELECT agency,
              COUNT(*) AS facts,
              MIN(period) AS first_period,
              MAX(period) AS last_period,
              MAX(retrieved_at) AS retrieved
       FROM fact
       GROUP BY agency
       ORDER BY facts DESC`,
    )
    .all() as unknown as Array<{
    agency: string;
    facts: number;
    first_period: string;
    last_period: string;
    retrieved: string;
  }>;

  return rows.map((row) => {
    const metrics = db
      .prepare("SELECT DISTINCT metric FROM fact WHERE agency = ? ORDER BY metric")
      .all(row.agency) as unknown as Array<{ metric: string }>;
    const measures = metrics.map((row) => labelFor(row.metric)).sort();
    return {
      agency: row.agency,
      measures,
      periodRange: row.first_period === row.last_period
        ? shortPeriod(row.first_period)
        : `${shortPeriod(row.first_period)} to ${shortPeriod(row.last_period)}`,
      facts: row.facts,
      retrieved: row.retrieved,
    };
  });
}
