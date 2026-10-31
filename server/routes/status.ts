/**
 * `/status` and `/healthz`.
 *
 * `/status` is for a reader: what is inside the file. `/healthz` is for a
 * monitor: is the file current. The health answer carries the same JSON at 200
 * and 503, so a reader can see why a monitor was told to act.
 */


import type { ServerResponse } from "node:http";
import { counts } from "../store.ts";
import { db, meta } from "../lib/runtime.ts";
import { send } from "../lib/http.ts";
import { status } from "../views/status.ts";
import {
  FRESHNESS,
  ageInDays,
  bandOf,
  fileFacts,
  spanBand,
  type FileFacts,
  type FreshnessBand,
} from "../lib/freshness.ts";

/** The JSON `/healthz` answers with, and the status a monitor acts on. */
export interface HealthBody {
  ok: boolean;
  data: string | null;
  built_at: string | null;
  facts: number;
  oldest: string | null;
  newest: string | null;
  oldest_retrieval: string | null;
  newest_fact: string | null;
  ageDays: number | null;
  band: FreshnessBand;
  agingAfterDays: number;
  staleAfterDays: number;
  stale_sources: string[];
}

export function healthReport(
  file: FileFacts,
  meta: Record<string, string>,
  now: Date = new Date(),
): { code: 200 | 503; body: HealthBody } {
  const band = spanBand({ oldest: file.oldestRetrieval, newest: file.newestRetrieval }, now);
  const stale = band === "stale";
  return {
    code: stale ? 503 : 200,
    body: {
      ok: !stale,
      data: meta["data.version"] ?? null,
      built_at: meta["build.finished_at"] ?? null,
      facts: file.facts,
      oldest: file.oldestRetrieval,
      newest: file.newestRetrieval,
      oldest_retrieval: file.oldestRetrieval,
      newest_fact: file.newestPeriod,
      ageDays: file.newestRetrieval ? ageInDays(file.newestRetrieval, now) : null,
      band,
      agingAfterDays: FRESHNESS.agingAfterDays,
      staleAfterDays: FRESHNESS.staleAfterDays,
      // A source is stale when even its newest retrieval is old, so a partial
      // refresh of one period does not make the whole source cry stale.
      stale_sources: file.agencies
        .filter((agency) => bandOf(agency.newestRetrieval, now) === "stale")
        .map((agency) => agency.agency),
    },
  };
}

interface HealthError {
  ok: false;
  data: string | null;
  built_at: string | null;
  error: string;
}

/**
 * The read sits behind a function so the failure path is testable: a broken
 * table throws from `fileFacts`, and that has to answer 503, not a 500 page.
 */
export function healthAnswer(
  read: () => FileFacts,
  meta: Record<string, string>,
  now: Date = new Date(),
): { code: 200 | 503; body: HealthBody | HealthError } {
  try {
    return healthReport(read(), meta, now);
  } catch (error) {
    return {
      code: 503,
      body: {
        ok: false,
        data: meta["data.version"] ?? null,
        built_at: meta["build.finished_at"] ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function routeStatus(url: URL, res: ServerResponse): Promise<boolean> {
  const path = url.pathname;

  if (path === "/healthz") {
    const answer = healthAnswer(() => fileFacts(db), meta);
    send(res, answer.code, JSON.stringify(answer.body), "application/json");
    return true;
  }
  if (path === "/status") {
    send(res, 200, status(counts(db), meta, fileFacts(db)));
    return true;
  }
  return false;
}
