#!/usr/bin/env node
import { openDb, getBuildMeta, DB_PATH } from "./db.ts";
import { readFileSync } from "node:fs";
import { buildAliasMap, readAliasRows } from "../server/lib/aliases.ts";

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

  // 5. A margin is never the estimate in disguise. The first run of the loader
  // read the margin column as the estimate, and every row of a level repeated
  // its own margin. One coincidence is real data: a place of two people has a
  // margin of two, and the agency publishes exactly that. A whole geography
  // level of one table repeating is a parse failure, so the test looks at the
  // level rather than the row.
  const repeatedMargins = q<{ table_id: string; rows: number; same: number }>(
    `SELECT table_id, COUNT(*) rows,
            SUM(CASE WHEN abs(moe - value) < 0.0001 THEN 1 ELSE 0 END) same
       FROM fact WHERE moe IS NOT NULL
      GROUP BY table_id, length(geoid)
     HAVING COUNT(*) >= 10 AND same = COUNT(*)`,
  );
  checks.push({
    name: "no table puts its margin in the estimate",
    ok: repeatedMargins.length === 0,
    detail: repeatedMargins.length
      ? repeatedMargins.map((r) => `${r.table_id} (${r.same} rows)`).join(", ")
      : "none",
  });

  // 6. No sentinel is published as a value. Census writes a negative code
  // where no number exists, and a value of -666666666 reads as a number to
  // anyone who opens the file. A margin cannot be negative either.
  const { n: sentinels } = one<{ n: number }>(
    `SELECT COUNT(*) n FROM fact
      WHERE value IN (-666666666, -999999999, -888888888, -222222222, -555555555)
         OR (moe IS NOT NULL AND moe < 0)`,
  );
  checks.push({
    name: "no Census sentinel is published",
    ok: sentinels === 0,
    detail: `${sentinels} sentinels`,
  });

  // 7. The database has a version and a build date.
  const meta = getBuildMeta(db);
  checks.push({
    name: "the file names its own version",
    ok: Boolean(meta["data.version"] && meta["build.finished_at"]),
    detail: `${meta["data.version"] ?? "none"} / ${meta["build.finished_at"]?.slice(0, 10) ?? "none"}`,
  });

  // 8. No metric name is published by two agencies. Two numbers under one name
  // is the fastest way to lose a reader's trust, so it fails the build.
  const { n: multiAgency } = one<{ n: number }>(
    `SELECT COUNT(*) n FROM (SELECT metric FROM fact GROUP BY metric
       HAVING COUNT(DISTINCT agency) > 1)`,
  );
  checks.push({
    name: "no metric is published by two agencies",
    ok: multiAgency === 0,
    detail: multiAgency === 0 ? "none" : `${multiAgency} ambiguous`,
  });

  // 9. ZIP coverage. A missing zcta table means nobody can type a ZIP, which is
  // how most people name where they live.
  let zctaCount = 0;
  try {
    zctaCount = one<{ n: number }>("SELECT COUNT(*) n FROM zcta").n;
  } catch {
    zctaCount = -1;
  }
  checks.push({
    name: "ZIP codes resolve to counties",
    ok: zctaCount > 30_000,
    detail: zctaCount < 0 ? "no zcta table" : `${zctaCount.toLocaleString()} mapped`,
  });

  // 10. Every place above 1,000 people has at least one fact. A loader that
  // silently skips a level leaves a report with a name and nothing under it.
  const { n: emptyPlaces } = one<{ n: number }>(
    `SELECT COUNT(*) n FROM place p
      WHERE p.kind = 'place' AND p.population >= 1000
        AND NOT EXISTS (SELECT 1 FROM fact f WHERE f.geoid = p.geoid)`,
  );
  checks.push({
    name: "every place above 1,000 people has a fact",
    ok: emptyPlaces === 0,
    detail: `${emptyPlaces} empty`,
  });

  // 11. Every place row the Census file returned reached the table. The loader
  // writes down what it saw, so a row lost on the way to SQLite fails here. A
  // file built before this record exists says so and passes on the measure it
  // does not hold.
  const returnedRows = Number(meta["census.place_rows"] ?? NaN);
  const skippedRows = Number(meta["census.place_rows_skipped"] ?? 0);
  const placeRows = one<{ n: number }>("SELECT COUNT(*) n FROM place WHERE kind = 'place'").n;
  const rowsAgree = Number.isFinite(returnedRows) && placeRows + skippedRows === returnedRows;
  checks.push({
    name: "every place row in the file is a place",
    ok: Number.isFinite(returnedRows) ? rowsAgree : true,
    detail: Number.isFinite(returnedRows)
      ? `${placeRows.toLocaleString()} of ${returnedRows.toLocaleString()} rows`
      : "not recorded in this file",
  });

  // 12. Golden numbers. Pinned to the 2024 ACS 5-year release. These guard the
  // parsing and the joins. If Census revises, this test moves.
  const golden: Array<[string, string, string, number]> = [
    ["42101", "population", "2020-2024", 1579706],
    ["42101", "median_household_income", "2020-2024", 61953],
    ["36061", "population", "2020-2024", 1629477],
    ["17031", "population", "2020-2024", 5182090],
    ["06037", "population", "2020-2024", 9808667],
    ["42101", "gdp", "2024", 134988949000],
    ["42101", "federal_obligations", "FY2025", 5566182485.82],
    ["42101", "unemployment_rate", "2026-09", 4.3],
  ];
  for (const [geoid, metric, period, expected] of golden) {
    const row = one<{ value: number } | undefined>(
      "SELECT value FROM fact WHERE geoid = ? AND metric = ? AND period = ?",
      geoid, metric, period,
    );
    const ok = Boolean(row) && Math.abs((row?.value ?? 0) - expected) <= Math.max(1, Math.abs(expected) * 1e-6);
    checks.push({
      name: `golden ${geoid} ${metric}`,
      ok,
      detail: row ? `${row.value} (expected ${expected})` : "missing",
    });
  }

  // 13. Aliases are unambiguous. A term with two GEOIDs has no correct answer,
  // so this fails and names both. The CSVs are the whole table.
  const aliasProblems: string[] = [];
  let aliasCount = 0;
  try {
    const rows = readAliasRows();
    aliasCount = rows.length;
    for (const [term, geoid] of buildAliasMap(rows)) {
      const target = one<{ n: number }>("SELECT COUNT(*) n FROM place WHERE geoid = ?", geoid);
      if (target.n === 0) aliasProblems.push(`"${term}" points at missing place ${geoid}`);
    }
  } catch (error) {
    aliasProblems.push((error as Error).message);
  }
  checks.push({
    name: "aliases resolve to one real place",
    ok: aliasProblems.length === 0,
    detail: aliasProblems.length ? aliasProblems.join("; ") : `${aliasCount} terms`,
  });

  // ---- report -------------------------------------------------------------
  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? "  ok  " : " FAIL "} ${c.name.padEnd(42)} ${c.detail}`);
  }

  const byAgency = q<{ agency: string; n: number }>("SELECT agency, COUNT(*) n FROM fact GROUP BY agency ORDER BY n DESC");

  const counts = one<{ places: number; facts: number; metrics: number }>(
    `SELECT (SELECT COUNT(*) FROM place) places,
            (SELECT COUNT(*) FROM fact)  facts,
            (SELECT COUNT(*) FROM metric) metrics`,
  );
  const bytes = (() => { try { return readFileSync(DB_PATH).byteLength; } catch { return 0; } })();
  console.log();
  for (const row of byAgency) console.log(`  ${String(row.n).padStart(7)}  ${row.agency}`);
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
