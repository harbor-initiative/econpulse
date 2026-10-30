import type { DatabaseSync } from "node:sqlite";
import { fetchJson, requireEnv, today } from "../fetch.ts";
import { insertMetrics, makeFactWriter, type FactRow } from "../db.ts";

/**
 * BEA loader — county and state output.
 *
 * The dataset name is `Regional`, not `CAGDP2`. `CAGDP2` is the table inside
 * it. Asking for `datasetname=CAGDP2` returns "the dataset requested does not
 * exist", which is a misleading error for a typo that looks correct.
 *
 * Values arrive in thousands of dollars and are converted to dollars here, so
 * every money value in the file is in the same unit and a reader never has to
 * check a column label before comparing two numbers.
 */

const API = "https://apps.bea.gov/api/data/";
const AGENCY = "U.S. Bureau of Economic Analysis";
const DATASET = "BEA Regional, CAGDP2";
const TABLE = "CAGDP2";
const FIRST_YEAR = 2016;
const LAST_YEAR = new Date().getFullYear() - 1;

interface BeaRow {
  GeoFips: string;
  GeoName: string;
  Code: string;
  DataValue: string;
  TimePeriod: string;
  CL_UNIT: string;
}

interface BeaResponse {
  BEAAPI?: {
    Results?: { Error?: { APIErrorDescription?: string }; Data?: BeaRow[] };
    Error?: string;
  };
}

async function getTable(geo: "COUNTY" | "STATE", key: string): Promise<BeaRow[]> {
  const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i).join(",");
  const url =
    `${API}?UserID=${key}&method=GetData&datasetname=Regional&TableName=${TABLE}` +
    `&GeoFips=${geo}&Year=${years}&LineCode=1&ResultFormat=JSON`;
  const payload = await fetchJson<BeaResponse>(url, { retries: 3, timeoutMs: 120_000 });
  const error = payload.BEAAPI?.Results?.Error?.APIErrorDescription ?? payload.BEAAPI?.Error;
  if (error) throw new Error(`BEA: ${error}`);
  return payload.BEAAPI?.Results?.Data ?? [];
}

export async function loadBea(db: DatabaseSync): Promise<{ places: number; facts: number; skipped: number }> {
  const key = requireEnv("BEA_API_KEY");
  const retrieved = today();

  const known = new Set(
    (db.prepare("SELECT geoid FROM place WHERE kind IN ('county','state')").all() as Array<{ geoid: string }>)
      .map((r) => r.geoid),
  );

  insertMetrics(db, [{
    id: "gdp",
    label: "Gross domestic product",
    unit: "usd",
    direction: "neutral",
    description: "BEA Regional, table CAGDP2, all industries, current dollars",
  }]);

  const writer = makeFactWriter(db);
  let facts = 0;
  const touched = new Set<string>();

  for (const geo of ["STATE", "COUNTY"] as const) {
    const rows = await getTable(geo, key);
    console.log(`  bea ${geo.toLowerCase().padEnd(6)} ${rows.length.toLocaleString()} rows`);

    for (const row of rows) {
      const geoid = String(row.GeoFips).padStart(geo === "STATE" ? 2 : 5, "0").slice(0, geo === "STATE" ? 2 : 5);
      // BEA includes a few geographies the Census place table does not carry.
      if (!known.has(geoid)) continue;
      const thousands = Number(row.DataValue);
      if (!Number.isFinite(thousands) || thousands === 0) continue;

      const fact: FactRow = {
        geoid,
        metric: "gdp",
        period: String(row.TimePeriod),
        value: thousands * 1000,
        agency: AGENCY,
        dataset: DATASET,
        table_id: `${TABLE}-1`,
        vintage: String(row.TimePeriod),
        retrieved_at: retrieved,
        moe: null,
        revision: "annual",
        note: "Current dollars. Not adjusted for inflation.",
      };
      writer.write(fact);
      facts += 1;
      touched.add(geoid);
    }
  }

  writer.commit();
  return { places: touched.size, facts, skipped: 0 };
}
