import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Thin wrapper over node:sqlite. No native module, no build step, works on the
 * Node that ships with a laptop.
 */

export const ROOT = resolve(import.meta.dirname, "..");
export const DB_PATH = process.env.ECONPULSE_DB ?? resolve(ROOT, "data", "econpulse.db");

export function openDb(path: string = DB_PATH, { fresh = false } = {}): DatabaseSync {
  if (fresh) {
    for (const suffix of ["", "-wal", "-shm"]) {
      try { rmSync(path + suffix); } catch { /* not there */ }
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA synchronous = NORMAL;");
  return db;
}

export function migrate(db: DatabaseSync): void {
  const sql = readFileSync(resolve(import.meta.dirname, "schema.sql"), "utf8");
  db.exec(sql);
}

export function setBuildMeta(db: DatabaseSync, entries: Record<string, string>): void {
  const stmt = db.prepare(
    "INSERT INTO build (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [k, v] of Object.entries(entries)) stmt.run(k, v);
}

export function getBuildMeta(db: DatabaseSync): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM build").all() as Array<{ key: string; value: string }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export interface FactRow {
  geoid: string;
  metric: string;
  period: string;
  value: number;
  agency: string;
  dataset: string;
  table_id?: string | null;
  vintage: string;
  retrieved_at: string;
  moe?: number | null;
  revision?: string | null;
  note?: string | null;
}

/** Buffered writer. One transaction for the whole load, which keeps a rebuild fast. */
export function makeFactWriter(db: DatabaseSync) {
  const stmt = db.prepare(`
    INSERT INTO fact (geoid, metric, period, value, agency, dataset, table_id,
                      vintage, retrieved_at, moe, revision, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(geoid, metric, period, agency, dataset) DO UPDATE SET
      value = excluded.value, moe = excluded.moe, revision = excluded.revision,
      note = excluded.note, vintage = excluded.vintage, retrieved_at = excluded.retrieved_at
  `);
  let written = 0;
  db.exec("BEGIN");
  return {
    write(row: FactRow) {
      stmt.run(
        row.geoid, row.metric, row.period, row.value,
        row.agency, row.dataset, row.table_id ?? null,
        row.vintage, row.retrieved_at,
        row.moe ?? null, row.revision ?? null, row.note ?? null,
      );
      written += 1;
    },
    commit() { db.exec("COMMIT"); },
    get count() { return written; },
  };
}

export function insertPlaces(db: DatabaseSync, places: Array<Record<string, unknown>>): void {
  const stmt = db.prepare(`
    INSERT INTO place (geoid, kind, name, short_name, state_fips, state_code, parent_geoid, population)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(geoid) DO UPDATE SET
      name = excluded.name, short_name = excluded.short_name, state_code = excluded.state_code,
      state_fips = excluded.state_fips, parent_geoid = excluded.parent_geoid,
      population = COALESCE(excluded.population, place.population)
  `);
  for (const p of places) {
    stmt.run(
      p.geoid as string, p.kind as string, p.name as string, (p.short_name ?? null) as string | null,
      (p.state_fips ?? null) as string | null, (p.state_code ?? null) as string | null,
      (p.parent_geoid ?? null) as string | null, (p.population ?? null) as number | null,
    );
  }
}

export function insertMetrics(db: DatabaseSync, metrics: Array<Record<string, unknown>>): void {
  const stmt = db.prepare(`
    INSERT INTO metric (id, label, unit, direction, description)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label, unit = excluded.unit,
      direction = excluded.direction, description = excluded.description
  `);
  for (const m of metrics) {
    stmt.run(m.id as string, m.label as string, m.unit as string, m.direction as string,
      (m.description ?? null) as string | null);
  }
}
