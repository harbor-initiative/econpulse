import type { DatabaseSync } from "node:sqlite";
import { fetchJson, requireEnv, today, sleep } from "../fetch.ts";
import { insertMetrics, makeFactWriter, type FactRow } from "../db.ts";

/**
 * BLS loader — Local Area Unemployment Statistics.
 *
 * The bulk file at bls.gov/web/metro/laucntycur14.txt is the obvious source and
 * it returns 403 to anything that is not a browser, including a browser. The
 * v2 API answers, so this batches series 50 at a time against it.
 *
 * County series are not seasonally adjusted. The national series here is
 * LNU04000000 for the same reason: mixing a seasonally adjusted national rate
 * with unadjusted county rates produces a comparison that is wrong every
 * January and nobody notices until March.
 */

const API = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const AGENCY = "U.S. Bureau of Labor Statistics";
const DATASET = "Local Area Unemployment Statistics";
const BATCH = 50;
const START_YEAR = "2024";
const END_YEAR = new Date().getFullYear().toString();

interface BlsPoint { year: string; period: string; value: string }
interface BlsSeries { seriesID: string; data: BlsPoint[] }
interface BlsResponse { status: string; message?: string[]; Results?: { series: BlsSeries[] } }

/** LAUCN + state(2) + county(3) + seven zeros + measure 03 */
export function countySeriesId(stateFips: string, countyFips: string): string {
  return `LAUCN${stateFips}${countyFips}0000000003`;
}

/** LASST + state(2) + thirteen zeros + measure 03 */
export function stateSeriesId(stateFips: string): string {
  return `LASST${stateFips}0000000000003`;
}

export const NATIONAL_SERIES = "LNU04000000";

function periodToMonth(period: string): string | null {
  if (!/^M(0[1-9]|1[0-2])$/.test(period)) return null;
  return period.slice(1);
}

async function fetchBatch(seriesIds: string[], key: string): Promise<Map<string, BlsSeries>> {
  const payload = await fetchJson<BlsResponse>(API, {
    method: "POST",
    retries: 3,
    timeoutMs: 60_000,
    body: { seriesid: seriesIds, startyear: START_YEAR, endyear: END_YEAR, registrationkey: key },
  });
  if (payload.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS rejected the batch: ${payload.message?.join(" ") ?? payload.status}`);
  }
  const map = new Map<string, BlsSeries>();
  for (const series of payload.Results?.series ?? []) map.set(series.seriesID, series);
  return map;
}

export async function loadBls(db: DatabaseSync): Promise<{ places: number; facts: number; skipped: number }> {
  const key = requireEnv("BLS_API_KEY");
  const retrieved = today();

  const counties = db
    .prepare("SELECT geoid FROM place WHERE kind = 'county' ORDER BY geoid")
    .all() as Array<{ geoid: string }>;
  const states = db
    .prepare("SELECT geoid FROM place WHERE kind = 'state' AND state_code IS NOT NULL ORDER BY geoid")
    .all() as Array<{ geoid: string }>;

  // seriesId -> geoid
  const lookup = new Map<string, string>();
  for (const { geoid } of counties) lookup.set(countySeriesId(geoid.slice(0, 2), geoid.slice(2)), geoid);
  for (const { geoid } of states) lookup.set(stateSeriesId(geoid), geoid);
  lookup.set(NATIONAL_SERIES, "0100000US");

  const ids = [...lookup.keys()];
  insertMetrics(db, [{
    id: "unemployment_rate",
    label: "Unemployment rate",
    unit: "percent",
    direction: "lower_is_better",
    description: "BLS Local Area Unemployment Statistics, monthly, not seasonally adjusted",
  }]);

  const writer = makeFactWriter(db);
  let facts = 0;
  let skipped = 0;
  const batches = Math.ceil(ids.length / BATCH);

  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    try {
      const series = await fetchBatch(slice, key);
      for (const [seriesId, data] of series) {
        const geoid = lookup.get(seriesId);
        if (!geoid) continue;
        for (const point of data.data) {
          const month = periodToMonth(point.period);
          const value = Number(point.value);
          if (!month || !Number.isFinite(value) || value <= 0) continue;
          const fact: FactRow = {
            geoid,
            metric: "unemployment_rate",
            period: `${point.year}-${month}`,
            value,
            agency: AGENCY,
            dataset: DATASET,
            table_id: seriesId,
            vintage: `${point.year}-${month}`,
            retrieved_at: retrieved,
            moe: null,
            revision: "provisional",
            note: "Not seasonally adjusted. Model-based estimate for counties.",
          };
          writer.write(fact);
          facts += 1;
        }
      }
      process.stdout.write(`\r  bls batch ${n}/${batches} · ${facts.toLocaleString()} facts   `);
    } catch (error) {
      skipped += slice.length;
      process.stdout.write(`\r  bls batch ${n}/${batches} failed: ${(error as Error).message.slice(0, 60)}\n`);
    }
    if (i + BATCH < ids.length) await sleep(350);
  }
  process.stdout.write("\n");
  writer.commit();
  return { places: lookup.size, facts, skipped };
}
