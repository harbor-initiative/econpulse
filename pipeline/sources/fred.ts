import type { DatabaseSync } from "node:sqlite";
import { fetchJson, requireEnv, today } from "../fetch.ts";
import { insertMetrics, makeFactWriter, type FactRow } from "../db.ts";

/**
 * FRED loader — national context.
 *
 * These are the only series in the file that are not about a place. They exist
 * so a reader can put a local dollar figure next to inflation: "rent is up 6.2%"
 * means something different when prices are up 3% than when they are up 8%.
 *
 * FRED distributes these series; someone else produces them. The receipt names the agency that
 * actually measured it, with FRED in the dataset, because "Federal Reserve
 * Economic Data" is not who counted the price of eggs.
 */

const API = "https://api.stlouisfed.org/fred/series/observations";
const DATASET = "FRED (Federal Reserve Bank of St. Louis)";

interface Series {
  id: string;
  metric: string;
  agency: string;
  label: string;
  unit: string;
  description: string;
}

const SERIES: Series[] = [
  {
    id: "CPIAUCSL",
    metric: "cpi",
    agency: "U.S. Bureau of Labor Statistics",
    label: "Consumer price index",
    unit: "index",
    description: "All urban consumers, all items, seasonally adjusted, 1982-84 = 100",
  },
  {
    id: "MORTGAGE30US",
    metric: "mortgage_rate_30y",
    agency: "Freddie Mac",
    label: "30-year fixed mortgage rate",
    unit: "percent",
    description: "Weekly average, national",
  },
];

interface Observations { observations?: Array<{ date: string; value: string }> }

async function getSeries(id: string, key: string): Promise<Array<{ date: string; value: string }>> {
  const start = `${new Date().getFullYear() - 6}-01-01`;
  const url = `${API}?series_id=${id}&api_key=${key}&file_type=json&observation_start=${start}`;
  const payload = await fetchJson<Observations>(url, { retries: 3, timeoutMs: 60_000 });
  return payload.observations ?? [];
}

export async function loadFred(db: DatabaseSync): Promise<{ places: number; facts: number; skipped: number }> {
  const key = requireEnv("FRED_API_KEY");
  const retrieved = today();

  insertMetrics(db, SERIES.map((s) => ({
    id: s.metric,
    label: s.label,
    unit: s.unit,
    direction: "neutral",
    description: s.description,
  })));

  const writer = makeFactWriter(db);
  let facts = 0;

  for (const series of SERIES) {
    const observations = await getSeries(series.id, key);
    let count = 0;
    for (const point of observations) {
      const value = Number(point.value);
      if (!Number.isFinite(value)) continue; // "." means no observation
      const fact: FactRow = {
        geoid: "0100000US",
        metric: series.metric,
        period: point.date,
        value,
        agency: series.agency,
        dataset: DATASET,
        table_id: series.id,
        vintage: point.date,
        retrieved_at: retrieved,
        moe: null,
        revision: "final",
        note: series.description,
      };
      writer.write(fact);
      facts += 1;
      count += 1;
    }
    console.log(`  fred ${series.id.padEnd(12)} ${count.toLocaleString()} observations`);
  }

  writer.commit();
  return { places: 1, facts, skipped: 0 };
}
