#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { appVersion } from "./lib/runtime.ts";
import {
  openStore, storePath, getPlace, searchPlaces, series, metricsFor,
  countyForPlace, counts, buildMeta,
} from "./store.ts";

/**
 * EconPulse over MCP.
 *
 * The same file the website reads, exposed to an agent. Every tool returns the
 * receipt with the number, because an agent quoting a figure without its
 * vintage is the exact failure this project exists to avoid.
 *
 * Read-only by construction: the database is opened read-only and no tool
 * writes anything anywhere.
 */

const db = openStore(storePath());
const meta = buildMeta(db);

// The same version the page prints in its footer, read from package.json at
// boot. A client that records which build answered should not be told 0.1.0 by
// a 0.13.0 image.
const server = new McpServer({ name: "econpulse", version: appVersion });

function json(value: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

/** Trim a fact to what a citation needs. */
function cite(fact: ReturnType<typeof series>[number]) {
  return {
    metric: fact.metric,
    label: fact.label,
    period: fact.period,
    value: fact.value,
    unit: fact.unit,
    agency: fact.agency,
    dataset: fact.dataset,
    table: fact.table_id,
    vintage: fact.vintage,
    retrieved_at: fact.retrieved_at,
    margin_of_error: fact.moe,
    revision: fact.revision,
    note: fact.note,
  };
}

server.tool(
  "search_places",
  "Find US places by name, county, or ZIP. Returns GEOIDs to use with the other tools.",
  { query: z.string().describe("A place name, county, or five-digit ZIP"), limit: z.number().min(1).max(25).default(10) },
  async ({ query, limit }) => {
    const places = searchPlaces(db, query, limit);
    return json({ query, count: places.length, places });
  },
);

server.tool(
  "get_place",
  "Everything EconPulse knows about one place, with a receipt on every value.",
  { geoid: z.string().describe("Census GEOID, for example 42101 for Philadelphia County") },
  async ({ geoid }) => {
    const place = getPlace(db, geoid);
    if (!place) return json({ error: `No place with GEOID ${geoid}. Try search_places.` });
    const facts = metricsFor(db, geoid).map((metric) => {
      const rows = series(db, geoid, metric);
      const latest = rows[rows.length - 1];
      return latest ? cite(latest) : null;
    }).filter(Boolean);
    return json({ place, facts });
  },
);

server.tool(
  "get_metric",
  "The full series for one measure in one place, oldest first, with its receipt.",
  {
    geoid: z.string().describe("Census GEOID"),
    metric: z.string().describe("Metric id, for example unemployment_rate or median_gross_rent"),
  },
  async ({ geoid, metric }) => {
    const place = getPlace(db, geoid);
    if (!place) return json({ error: `No place with GEOID ${geoid}.` });
    const rows = series(db, geoid, metric);
    if (!rows.length) {
      return json({ error: `No ${metric} series for ${place.name}.`, available: metricsFor(db, geoid) });
    }
    return json({ place, metric, points: rows.map(cite) });
  },
);

server.tool(
  "compare_places",
  "Put two to five places side by side on every measure they share.",
  { geoids: z.array(z.string()).min(2).max(5).describe("Two to five Census GEOIDs") },
  async ({ geoids }) => {
    const out = geoids.map((geoid) => {
      const place = getPlace(db, geoid);
      if (!place) return { geoid, error: "not found" };
      const facts = metricsFor(db, geoid).map((metric) => {
        const rows = series(db, geoid, metric);
        const latest = rows[rows.length - 1];
        return latest ? cite(latest) : null;
      }).filter(Boolean);
      return { place, facts };
    });
    return json({ places: out });
  },
);

server.tool(
  "list_metrics",
  "Every measure in the file, with its unit, direction, and who publishes it.",
  {},
  async () => {
    const rows = db.prepare(
      `SELECT DISTINCT m.id, m.label, m.unit, m.direction, f.agency, f.dataset
       FROM metric m JOIN fact f ON f.metric = m.id
       ORDER BY m.id`,
    ).all();
    return json({ metrics: rows });
  },
);

server.tool(
  "describe_data",
  "What is in this file, how current it is, and what it does not cover.",
  {},
  async () => {
    const c = counts(db);
    return json({
      ...c,
      data_version: meta["data.version"],
      built_at: meta["build.finished_at"],
      sources: meta["build.sources"],
      limits: [
        "No ZIP code (ZCTA) coverage.",
        "Places are city boundaries; metro figures measure something else.",
        "BLS county figures are model-based estimates.",
        "ACS five-year figures are averages over five years and will disagree with BLS by design.",
        "Federal obligations are not outlays, and sit at the place of performance.",
      ],
    });
  },
);

server.tool(
  "county_for_place",
  "Find the county a city sits in, so county-level measures can be quoted for it.",
  { geoid: z.string().describe("Census GEOID of a place") },
  async ({ geoid }) => {
    const place = getPlace(db, geoid);
    if (!place) return json({ error: `No place with GEOID ${geoid}.` });
    const county = countyForPlace(db, place);
    return json(county ? { place, county, note: "Matched by name. Verify before citing." } : { place, county: null });
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only: stdout is the protocol channel.
  console.error(`econpulse mcp ${appVersion} · data ${meta["data.version"] ?? "?"} · ${storePath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
