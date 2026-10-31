import type { DatabaseSync } from "node:sqlite";
import { fetchJson, today } from "../fetch.ts";
import { insertMetrics, makeFactWriter, type FactRow } from "../db.ts";

/**
 * USAspending loader — federal obligations by county.
 *
 * No key required. One request per fiscal year returns every county at once,
 * which is the whole reason this source is cheap to include.
 *
 * This number records money obligated at the place of performance. Outlays come
 * later, and the contractor may be headquartered elsewhere. Both caveats are
 * written onto every row, because a reader who assumes either one will draw the
 * wrong conclusion about their town.
 */

const API = "https://api.usaspending.gov/api/v2/search/spending_by_geography/";
const AGENCY = "USAspending.gov";
const DATASET = "Federal award obligations by county";
const FIRST_FY = 2021;
const LAST_FY = new Date().getFullYear();

interface GeoRow {
  shape_code: string;
  display_name: string;
  aggregated_amount: number;
  population: number | null;
  per_capita: number | null;
}

interface GeoResponse { results?: GeoRow[]; messages?: string[] }

function fiscalWindow(fy: number): { start_date: string; end_date: string } {
  return { start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30` };
}

async function getYear(fy: number): Promise<GeoRow[]> {
  const payload = await fetchJson<GeoResponse>(API, {
    method: "POST",
    retries: 3,
    timeoutMs: 180_000,
    body: {
      scope: "place_of_performance",
      geo_layer: "county",
      filters: { time_period: [fiscalWindow(fy)], award_type_codes: ["A", "B", "C", "D"] },
      spending_level: "awards",
    },
  });
  return payload.results ?? [];
}

export async function loadUsaSpending(db: DatabaseSync): Promise<{ places: number; facts: number; skipped: number }> {
  const retrieved = today();
  const known = new Set(
    (db.prepare("SELECT geoid FROM place WHERE kind = 'county'").all() as Array<{ geoid: string }>)
      .map((r) => r.geoid),
  );

  insertMetrics(db, [{
    id: "federal_obligations",
    label: "Federal obligations",
    unit: "usd",
    direction: "neutral",
    description: "USAspending.gov, awards by place of performance, fiscal year",
  }]);

  const writer = makeFactWriter(db);
  let facts = 0;
  const touched = new Set<string>();

  for (let fy = FIRST_FY; fy <= LAST_FY; fy += 1) {
    const rows = await getYear(fy);
    let yearFacts = 0;
    for (const row of rows) {
      const geoid = String(row.shape_code).padStart(5, "0");
      if (!known.has(geoid)) continue;
      const amount = Number(row.aggregated_amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const fact: FactRow = {
        geoid,
        metric: "federal_obligations",
        period: `FY${fy}`,
        value: amount,
        agency: AGENCY,
        dataset: DATASET,
        table_id: "spending_by_geography",
        vintage: `FY${fy}`,
        retrieved_at: retrieved,
        moe: null,
        revision: fy === LAST_FY ? "provisional" : "final",
        note: fy === LAST_FY
          ? "Obligations, not outlays. Place of performance, not recipient address. Current fiscal year, still being reported."
          : "Obligations, not outlays. Place of performance, not recipient address.",
      };
      writer.write(fact);
      facts += 1;
      yearFacts += 1;
      touched.add(geoid);
    }
    console.log(`  usaspending FY${fy}  ${yearFacts.toLocaleString()} counties`);
  }

  writer.commit();
  return { places: touched.size, facts, skipped: 0 };
}
