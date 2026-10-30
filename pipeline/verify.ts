#!/usr/bin/env node
import { openDb, getBuildMeta, DB_PATH } from "./db.ts";
import { readFileSync } from "node:fs";

/**
 * The gate.
 *
 * Every fact must carry a receipt. Every place must be real. A handful of
 * numbers are pinned to what the agency published, so a pipeline change that
 * quietly moves them fails here instead of on the website.
 */

interface Check { name: string; ok: boolean; detail: string }
type Param = string | number | bigint | null;

function main(): void {
  const db = openDb(DB_PATH);
  const checks: Check[] = [];
  const q = <T>(sql: string, ...args: Param[]) => db.prepare(sql).all(...args) as T[];
  const one = <T>(sql: string, ...args: Param[]) => db.prepare(sql).get(...args) as T;

  // 1. Receipts are complete.
  const { n: incomplete } = one<{ n: number }>(
    `SELECT COUNT(*) n FROM fact
     WHERE agency IS NULL OR dataset IS NULL OR vintage IS NULL OR retrieved_at IS NULL`,
  );
  checks.push({ name: "every fact has a receipt", ok: incomplete === 0, detail: `${incomplete} missing` });

  // 2. No orphan facts.
  const { n: orphans } = one<{ n: number }>(
    "SELECT COUNT(*) n FROM fact f LEFT JOIN place p ON p.geoid = f.geoid WHERE p.geoid IS NULL",
  );
  checks.push({ name: "no fact points at a missing place", ok: orphans === 0, detail: `${orphans} orphans` });

  // 3. No unknown metrics.
  const { n: unknownMetrics } = one<{ n: number }>(
    "SELECT COUNT(*) n FROM fact f LEFT JOIN metric m ON m.id = f.metric WHERE m.id IS NULL",
  );
  checks.push({ name: "no fact uses an undefined metric", ok: unknownMetrics === 0, detail: `${unknownMetrics} unknown` });

  // 4. Population is never negative, and never absurd.
  const { n: badPop } = one<{ n: number }>(
    `SELECT COUNT(*) n FROM fact f JOIN place p ON p.geoid = f.geoid
     WHERE f.metric = 'population' AND (f.value < 0 OR (p.kind <> 'us' AND f.value > 40000000))`,
  );
  checks.push({ name: "population values are plausible", ok: badPop === 0, detail: `${badPop} out of range` });

  // 5. Margins never equal their estimate.
  const { n: badMoe } = one<{ n: number }>(
    "SELECT COUNT(*) n FROM fact WHERE moe IS NOT NULL AND abs(moe - value) < 0.0001",
  );
  checks.push({
    name: "no margin duplicates its estimate",
    ok: badMoe === 0,
    detail: `${badMoe} suspect`,
  });

  // 6. The database has a version and a build date.
  const meta = getBuildMeta(db);
  checks.push({
    name: "the file names its own version",
    ok: Boolean(meta["data.version"] && meta["build.finished_at"]),
    detail: `${meta["data.version"] ?? "none"} / ${meta["build.finished_at"]?.slice(0, 10) ?? "none"}`,
  });

  // 7. Golden numbers. Pinned to the 2024 ACS 5-year release. These guard the
  // parsing and the joins, not the agencies: if Census revises, this test moves.
  const golden: Array<[string, string, string, number]> = [
    ["42101", "population", "2020-2024", 1579706],
    ["42101", "median_household_income", "2020-2024", 61953],
    ["36061", "population", "2020-2024", 1629477],
    ["17031", "population", "2020-2024", 5182090],
    ["06037", "population", "2020-2024", 9808667],
  ];
  for (const [geoid, metric, period, expected] of golden) {
    const row = one<{ value: number } | undefined>(
      "SELECT value FROM fact WHERE geoid = ? AND metric = ? AND period = ?",
      geoid, metric, period,
    );
    const ok = Boolean(row) && Math.abs((row?.value ?? 0) - expected) < 1;
    checks.push({
      name: `golden ${geoid} ${metric}`,
      ok,
      detail: row ? `${row.value} (expected ${expected})` : "missing",
    });
  }

  // ---- report -------------------------------------------------------------
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? "  ok  " : " FAIL "} ${c.name.padEnd(42)} ${c.detail}`);
  }

  const counts = one<{ places: number; facts: number; metrics: number }>(
    `SELECT (SELECT COUNT(*) FROM place) places,
            (SELECT COUNT(*) FROM fact)  facts,
            (SELECT COUNT(*) FROM metric) metrics`,
  );
  const bytes = (() => { try { return readFileSync(DB_PATH).byteLength; } catch { return 0; } })();
  console.log(
    `\n${counts.places.toLocaleString()} places · ${counts.facts.toLocaleString()} facts · ` +
    `${counts.metrics} metrics · ${(bytes / 1024 / 1024).toFixed(1)} MB · data ${meta["data.version"] ?? "?"}`,
  );

  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

main();
