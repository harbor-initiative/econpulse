#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDb, migrate, setBuildMeta, getBuildMeta, ROOT, DB_PATH } from "./db.ts";
import { loadCensus } from "./sources/census.ts";
import { loadBls } from "./sources/bls.ts";
import { loadBea } from "./sources/bea.ts";
import { loadUsaSpending } from "./sources/usaspending.ts";
import { loadFred } from "./sources/fred.ts";

/**
 * The build CLI.
 *
 *   pnpm load                 rebuild everything from zero
 *   pnpm load --only=census   one source
 *   pnpm load --keep          add to the existing file instead of replacing it
 *   pnpm verify               check the receipts and the headline numbers
 */

function loadEnvFile(): void {
  for (const name of [".env", ".env.local"]) {
    const path = resolve(ROOT, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key]) continue;
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

const SOURCES = {
  census: { run: loadCensus, needs: ["CENSUS_API_KEY"] },
  bls: { run: loadBls, needs: ["BLS_API_KEY"] },
  bea: { run: loadBea, needs: ["BEA_API_KEY"] },
  usaspending: { run: loadUsaSpending, needs: [] },
  fred: { run: loadFred, needs: ["FRED_API_KEY"] },
} as const;

type SourceName = keyof typeof SOURCES;

function parseArgs(argv: string[]) {
  const flags = new Map<string, string | true>();
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.slice(2).split("=");
    flags.set(key, value ?? true);
  }
  return flags;
}

async function main(): Promise<void> {
  loadEnvFile();
  const flags = parseArgs(process.argv);
  const only = typeof flags.get("only") === "string" ? (flags.get("only") as string) : null;
  // Only a full rebuild replaces the file. A single-source run adds to it.
  const fresh = !only && !flags.has("keep");

  const names = only ? [only as SourceName] : (Object.keys(SOURCES) as SourceName[]);
  for (const name of names) {
    if (!SOURCES[name]) {
      console.error(`Unknown source: ${name}. Try one of ${Object.keys(SOURCES).join(", ")}.`);
      process.exit(1);
    }
  }

  const started = Date.now();
  const db = openDb(DB_PATH, { fresh });
  migrate(db);
  // A single-source run adds to the file; only a full rebuild wipes it.
  if (!only) {
    db.exec("BEGIN");
    db.exec("DELETE FROM fact; DELETE FROM place; DELETE FROM metric; DELETE FROM zcta;");
    db.exec("COMMIT");
  }

  console.log(`Building ${DB_PATH}`);
  let totalFacts = 0;
  for (const name of names) {
    const source = SOURCES[name];
    for (const env of source.needs) {
      if (!process.env[env]) {
        console.error(`\n${name} needs ${env}. Put it in .env at the repo root.`);
        process.exit(2);
      }
    }
    console.log(`\n${name}`);
    const result = await source.run(db);
    totalFacts += result.facts;
    console.log(`  ${result.places.toLocaleString()} places, ${result.facts.toLocaleString()} facts`);
  }

  // Derived from the file, not from the flags. A single-source run must not
  // claim the file only contains that source.
  const loaded = (db.prepare("SELECT DISTINCT agency FROM fact ORDER BY agency").all() as unknown as Array<{ agency: string }>)
    .map((r) => r.agency);
  setBuildMeta(db, {
    "data.version": new Date().toISOString().slice(0, 7).replace("-", "."),
    "build.finished_at": new Date().toISOString(),
    "build.sources": loaded.join(" · "),
    "build.source_count": String(loaded.length),
  });

  db.exec("ANALYZE");
  db.exec("VACUUM");
  // Fold the write-ahead log back into the file so the artifact is one file.
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

  const counts = db.prepare("SELECT (SELECT COUNT(*) FROM place) p, (SELECT COUNT(*) FROM fact) f").get() as {
    p: number; f: number;
  };
  console.log(
    `\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s · ` +
    `${counts.p.toLocaleString()} places · ${counts.f.toLocaleString()} facts · ` +
    `${(readFileSize(DB_PATH) / 1024 / 1024).toFixed(1)} MB`,
  );
  db.close();
}

function readFileSize(path: string): number {
  try { return readFileSync(path).byteLength; } catch { return 0; }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().catch((error) => {
    console.error("\nBuild failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { main, getBuildMeta };
