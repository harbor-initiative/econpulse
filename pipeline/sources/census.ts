import { fetchJson, fetchText, requireEnv, today } from "../fetch.ts";
import type { DatabaseSync } from "node:sqlite";
import { insertPlaces, makeFactWriter, setBuildMeta, type FactRow } from "../db.ts";

/**
 * Census loader.
 *
 * Three calls per dataset, one per geography level: state, county, place. The
 * API returns every geography in the country in a single response, which is why
 * this pipeline rebuilds the whole file in under a minute rather than overnight.
 *
 * ACS margins of error are pulled where they matter and carried onto the fact
 * row. A number without its margin cannot be checked against anything.
 *
 * Suffixes are sliced. `_E$` never matches `B01003_001E`,
 * because the string ends in `1E`. That mistake put the estimate in the margin
 * column on the first run.
 */

const YEAR = "2024";
const PERIOD = "2020-2024";
const AGENCY = "U.S. Census Bureau";
const DATASET = "American Community Survey 5-Year";

/**
 * Places below this are dropped from the file. Counties and states never are.
 *
 * The default is 0, which keeps every place in the Census file. A place a
 * reader can find with no figure beside it is still a place a reader can find;
 * a place that was never loaded is a dead end. Set `MIN_PLACE_POPULATION` to a
 * number for a lean build.
 *
 * A place with no population value is never dropped, at any floor. The file is
 * the list of places, and the count is one fact about a place rather than the
 * reason to include it.
 */
export const MIN_PLACE_POPULATION = Number(process.env.MIN_PLACE_POPULATION ?? 0);

interface Variable {
  code: string;
  metric: string;
  label: string;
  unit: string;
  direction: string;
  table: string;
  note?: string;
}

const DETAIL: Variable[] = [
  { code: "B01003_001E", metric: "population", label: "Population", unit: "people", direction: "neutral", table: "B01003" },
  { code: "B19013_001E", metric: "median_household_income", label: "Median household income", unit: "usd", direction: "higher_is_better", table: "B19013" },
  { code: "B25064_001E", metric: "median_gross_rent", label: "Median gross rent", unit: "usd_per_month", direction: "lower_is_better", table: "B25064", note: "2024 dollars, as published" },
  { code: "B25077_001E", metric: "median_home_value", label: "Median home value", unit: "usd", direction: "neutral", table: "B25077", note: "Owner-occupied units, 2024 dollars" },
  { code: "B01002_001E", metric: "median_age", label: "Median age", unit: "years", direction: "neutral", table: "B01002" },
];

const PROFILE: Variable[] = [
  { code: "DP03_0009PE", metric: "unemployment_rate_acs", label: "Unemployment rate, five-year average", unit: "percent", direction: "lower_is_better", table: "DP03", note: "ACS five-year average. BLS publishes the current monthly rate under unemployment_rate; the two will not match." },
  { code: "DP03_0002PE", metric: "labor_force_participation_rate", label: "Labor force participation rate", unit: "percent", direction: "higher_is_better", table: "DP03" },
  { code: "DP02_0068PE", metric: "bachelors_or_higher", label: "Bachelor's degree or higher", unit: "percent", direction: "higher_is_better", table: "DP02" },
  { code: "DP03_0128PE", metric: "poverty_rate", label: "Poverty rate", unit: "percent", direction: "lower_is_better", table: "DP03" },
];

const MOE_FOR = new Set(["B01003", "B19013"]);

/**
 * The five values Census uses where no number exists. Compared as numbers,
 * because one sentinel arrives as "-666666666" on some tables and as
 * "-666666666.0" on others, and a string test for the first misses the second.
 */
const SENTINELS = new Set([
  -666666666, // not applicable
  -999999999, // not available
  -888888888, // not available
  -222222222, // controlled / suppressed
  -555555555, // too few samples to compute a margin
]);

const STATE_CODES: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
  "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
  "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
  "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI",
};

const ZCTA_COUNTY_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt";

type Level = "state" | "county" | "place" | "us";
type Row = Record<string, string>;

function parseTable(payload: unknown): Row[] {
  if (!Array.isArray(payload) || payload.length < 2) return [];
  const [headers, ...rows] = payload as string[][];
  return rows.map((cells) => {
    const record: Row = {};
    headers.forEach((header, index) => { record[header] = cells[index]; });
    return record;
  });
}

function num(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = value.trim();
  if (text === "" || text === "null") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return SENTINELS.has(n) ? null : n;
}

/**
 * A margin of error is a distance from the estimate. Census writes
 * -333333333 when the median falls outside the published brackets, which is
 * an absent margin rather than a negative one.
 */
function margin(value: string | null | undefined): number | null {
  const n = num(value);
  return n !== null && n >= 0 ? n : null;
}

function geoidFor(level: Level, row: Row): string | null {
  if (level === "us") return "0100000US";
  if (level === "state") return row.state ?? null;
  if (level === "county") return row.state && row.county ? `${row.state}${row.county}` : null;
  if (level === "place") return row.state && row.place ? `${row.state}${row.place}` : null;
  return null;
}

function splitName(name: string, level: Level): { name: string; short: string } {
  if (level === "us") return { name: "United States", short: "United States" };
  if (level === "state") return { name, short: name };
  const parts = name.split(", ");
  return { name, short: parts[0] ?? name };
}

async function getLevel(level: Level, dataset: "acs5" | "acs5/profile", variables: Variable[]): Promise<Row[]> {
  const key = requireEnv("CENSUS_API_KEY");
  const codes = variables.map((v) => v.code);
  const moes = variables.filter((v) => MOE_FOR.has(v.table)).map((v) => `${v.code.slice(0, -1)}M`);
  const get = ["NAME", ...codes, ...moes].join(",");
  const geography = level === "us" ? "for=us:1" : `for=${level}:*`;
  const url = `https://api.census.gov/data/${YEAR}/acs/${dataset}?get=${get}&${geography}&key=${key}`;
  return parseTable(await fetchJson<unknown>(url, { retries: 2 }));
}

/**
 * ZIP codes follow postal routes, so a ZCTA does not get its own facts. It
 * gets a parent: the county that holds most of its land. The report for a ZIP
 * is then the county report, labelled with the ZIP, which is both honest and
 * what the person typing their ZIP actually wanted.
 */
export async function loadZctaCounties(db: DatabaseSync, counties: Set<string>): Promise<number> {
  const text = await fetchText(ZCTA_COUNTY_URL);
  const lines = text.replace(/^\uFEFF/, "").split("\n");
  const header = lines[0]?.split("|") ?? [];
  const zIdx = header.indexOf("GEOID_ZCTA5_20");
  const cIdx = header.indexOf("GEOID_COUNTY_20");
  const landIdx = header.indexOf("AREALAND_PART");
  if (zIdx < 0 || cIdx < 0 || landIdx < 0) throw new Error("ZCTA relationship file changed shape");

  // One county per ZIP: whichever holds the most land.
  const best = new Map<string, { county: string; land: number }>();
  for (const line of lines.slice(1)) {
    const cells = line.split("|");
    const zcta = cells[zIdx]?.trim();
    const county = cells[cIdx]?.trim();
    if (!zcta || !county || !counties.has(county)) continue;
    const land = Number(cells[landIdx] ?? 0) || 0;
    const current = best.get(zcta);
    if (!current || land > current.land) best.set(zcta, { county, land });
  }

  const stmt = db.prepare(
    "INSERT INTO zcta (zcta, county_geoid) VALUES (?, ?) ON CONFLICT(zcta) DO UPDATE SET county_geoid = excluded.county_geoid",
  );
  for (const [zcta, { county }] of best) stmt.run(zcta, county);
  return best.size;
}

export async function loadCensus(db: DatabaseSync): Promise<{ places: number; facts: number; skipped: number }> {
  const retrieved = today();
  const levels: Level[] = ["state", "county", "place", "us"];

  const detail: Record<string, Row[]> = {};
  const profile: Record<string, Row[]> = {};
  for (const level of levels) {
    detail[level] = await getLevel(level, "acs5", DETAIL);
    profile[level] = await getLevel(level, "acs5/profile", PROFILE);
    console.log(`  census ${level.padEnd(7)} ${detail[level].length.toLocaleString()} rows`);
  }

  // ---- places, filtered ---------------------------------------------------
  const places: Array<Record<string, unknown>> = [];
  const kept = new Set<string>();
  let skipped = 0;

  for (const level of levels) {
    for (const row of detail[level]) {
      const geoid = geoidFor(level, row);
      if (!geoid) continue;
      const population = num(row.B01003_001E);
      const underFloor =
        level === "place" &&
        MIN_PLACE_POPULATION > 0 &&
        population !== null &&
        population < MIN_PLACE_POPULATION;
      if (underFloor) { skipped += 1; continue; }

      const { name, short } = splitName(row.NAME ?? "", level);
      const stateFips = level === "state" ? geoid : (row.state ?? null);
      kept.add(geoid);
      places.push({
        geoid,
        kind: level,
        name,
        short_name: short,
        state_fips: stateFips,
        state_code: stateFips ? (STATE_CODES[stateFips] ?? null) : null,
        parent_geoid: level === "county" || level === "place" ? (row.state ?? null) : null,
        population: population === null ? null : Math.round(population),
      });
    }
  }
  insertPlaces(db, places);
  // What the agency returned, so the gate can prove the file holds every row
  // instead of trusting the loader that dropped one.
  setBuildMeta(db, {
    "census.place_rows": String(detail["place"].length),
    "census.place_rows_skipped": String(skipped),
  });

  // ---- metrics dimension --------------------------------------------------
  const insertMetric = db.prepare(
    "INSERT OR REPLACE INTO metric (id,label,unit,direction,description) VALUES (?,?,?,?,?)",
  );
  for (const v of [...DETAIL, ...PROFILE]) {
    insertMetric.run(v.metric, v.label, v.unit, v.direction, `Census ${DATASET}, table ${v.table}`);
  }

  // ---- facts --------------------------------------------------------------
  const writer = makeFactWriter(db);
  let facts = 0;

  const emit = (level: Level, variables: Variable[], rows: Row[], datasetLabel: string) => {
    for (const row of rows) {
      const geoid = geoidFor(level, row);
      if (!geoid || !kept.has(geoid)) continue;
      for (const v of variables) {
        const value = num(row[v.code]);
        if (value === null) continue;
        const fact: FactRow = {
          geoid,
          metric: v.metric,
          period: PERIOD,
          value,
          agency: AGENCY,
          dataset: datasetLabel,
          table_id: v.table,
          vintage: YEAR,
          retrieved_at: retrieved,
          moe: MOE_FOR.has(v.table) ? margin(row[`${v.code.slice(0, -1)}M`]) : null,
          revision: "annual",
          note: v.note ?? null,
        };
        writer.write(fact);
        facts += 1;
      }
    }
  };

  for (const level of levels) emit(level, DETAIL, detail[level], DATASET);
  for (const level of levels) emit(level, PROFILE, profile[level], `${DATASET}, Data Profile`);

  writer.commit();

  const counties = new Set(
    (db.prepare("SELECT geoid FROM place WHERE kind = 'county'").all() as unknown as Array<{ geoid: string }>)
      .map((r) => r.geoid),
  );
  const zctas = await loadZctaCounties(db, counties);
  console.log(`  zcta    ${zctas.toLocaleString()} ZIP codes mapped to counties`);

  if (skipped) console.log(`  dropped ${skipped.toLocaleString()} places under ${MIN_PLACE_POPULATION.toLocaleString()} people`);
  return { places: places.length + zctas, facts, skipped };
}
