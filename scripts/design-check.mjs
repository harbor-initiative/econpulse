#!/usr/bin/env node
/**
 * The design gate.
 *
 *   node scripts/design-check.mjs              measure and report
 *   node scripts/design-check.mjs --json out   also write a stable record
 *
 * Nine rules from docs/remediation/specs/05-design-system.md, measured in a real
 * browser at three widths. Reading the CSS proves nothing: a rule that is not
 * measured has already been broken at least once in this repository, which is
 * why this file exists before the design work does.
 *
 * The report is deterministic on purpose. A refactor must not change it, and a
 * refactor that changes it is not a refactor. That is what makes this usable as
 * #35's proof, not only as #34's target.
 */

import { findChrome, launchChrome, openPage, decodePng, colouredShare } from "./lib/cdp.mjs";
import { probe } from "./lib/probe.mjs";
import { startServer } from "./lib/server.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROUTES = [
  { slug: "home", path: "/" },
  { slug: "place-county", path: "/p/42101" },
  { slug: "place-city", path: "/p/4260000" },
  { slug: "ask-question", path: "/ask?q=Is+rent+going+up+in+Austin" },
  { slug: "status", path: "/status" },
  { slug: "not-found", path: "/nope" },
];

const WIDTHS = [
  { width: 1440, height: 900, name: "desktop" },
  { width: 1024, height: 768, name: "tablet" },
  { width: 390, height: 844, name: "phone" },
];

const ALLOWED_HEADINGS = [
  { size: 28, role: "place" },
  { size: 46, role: "score" },
];

function checkHeadings(rows) {
  const offenders = rows.filter((row) => {
    if (row.size <= 24.5) return false;
    return !ALLOWED_HEADINGS.some(
      (allowed) => Math.abs(row.size - allowed.size) <= 1 && (allowed.role === "place" ? row.isPlace : row.isScore),
    );
  });
  return offenders.map((row) => `${row.element} at ${row.size}px ("${row.text}")`);
}

/** G1 .. G9, each returning a list of human-readable failures. */
const RULES = [
  {
    id: "G1",
    name: "colour budget",
    run: (m) => (m.colour.share > 0.05 ? [`${(m.colour.share * 100).toFixed(1)}% of pixels carry hue, budget 5%`] : []),
    warn: (m) => (m.colour.share > 0.03 ? [`${(m.colour.share * 100).toFixed(1)}% of pixels carry hue, target 3%`] : []),
  },
  {
    id: "G2",
    name: "flat surfaces",
    run: (m) => m.page.shadows.filter((s) => !s.isSearch).map((s) => `${s.element} carries ${s.shadow}`),
  },
  {
    id: "G3",
    name: "no hero heading",
    run: (m) => checkHeadings(m.page.headings),
  },
  {
    id: "G4",
    name: "two series get a legend",
    run: (m) => m.page.charts.filter((c) => c.twoSeries && !c.legend).map((c) => `${c.element} draws ${c.series} marks and no legend`),
  },
  {
    id: "G5",
    name: "contrast",
    run: (m) => m.page.contrast
      .filter((row) => row.ratio < (row.size >= 24 ? 3 : 4.5))
      .map((row) => `${row.element} "${row.text}" at ${row.ratio.toFixed(2)}:1, ${row.size}px`),
  },
  {
    id: "G6",
    name: "tabular numbers",
    run: (m) => {
      const problems = m.page.numbers.filter((n) => !String(n.numeric).includes("tabular-nums")).map((n) => `${n.element} "${n.text}" is ${n.numeric}`);
      if (m.route.startsWith("/p/") && m.page.numbers.length === 0) problems.push("no [data-number] element on a report page");
      return problems;
    },
  },
  {
    id: "G7",
    name: "no sideways scroll",
    run: (m) => (m.page.overflow > 1 ? [`scrollWidth exceeds the viewport by ${m.page.overflow}px`] : []),
  },
  {
    id: "G8",
    name: "every panel has a visual",
    run: (m) => m.page.panels.filter((p) => !p.visual && !p.empty).map((p) => `${p.element} ("${p.label}") is a value and a receipt`),
  },
  {
    id: "G9",
    name: "search on every page",
    run: (m) => (m.page.topbarSearch ? [] : ["the top bar carries no search input"]),
  },
];

const jsonFlag = process.argv.indexOf("--json");
const jsonPath = jsonFlag > -1 ? process.argv[jsonFlag + 1] : null;
const verbose = process.argv.includes("--verbose");

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error("\n  no Chrome found. Set CHROME_PATH, or install Chrome.\n  The gate skips but never passes silently.\n");
    process.exit(process.env.CI ? 1 : 0);
  }

  const server = await startServer();
  const browser = await launchChrome(chrome);
  const page = await openPage(browser.url);
  const record = [];
  let failures = 0;
  let warnings = 0;

  try {
    for (const route of ROUTES) {
      for (const size of WIDTHS) {
        await page.setViewport(size.width, size.height);
        await page.goto(`${server.base}${route.path}`);
        const measured = await page.evaluate(`(${probe.toString()})()`);
        const shot = decodePng(await page.screenshot());
        const colour = colouredShare(shot);

        const context = { route: route.path, viewport: `${size.width}x${size.height}`, page: measured, colour };
        const row = { slug: route.slug, path: route.path, viewport: size.name, failures: [], warnings: [] };

        for (const rule of RULES) {
          const problems = rule.run(context);
          if (problems.length) {
            row.failures.push({ rule: rule.id, problems });
            failures += problems.length;
            if (verbose) console.log(`  FAIL ${rule.id} ${route.path} ${row.viewport}: ${problems.join("; ")}`);
          }
          const mild = rule.warn ? rule.warn(context) : [];
          if (mild.length) {
            row.warnings.push({ rule: rule.id, problems: mild });
            warnings += mild.length;
          }
        }

        if (!verbose && row.failures.length) {
          for (const failure of row.failures) {
            console.log(`  ${failure.rule}  ${failure.problems.length} at ${route.path} ${row.viewport}`);
            for (const problem of failure.problems.slice(0, 2)) console.log(`        ${problem}`);
          }
        }

        record.push({ ...row, colour: Math.round(colour.share * 100000) / 100000 });
      }
    }
  } finally {
    page.close();
    await browser.close();
    server.stop();
  }

  const total = ROUTES.length * WIDTHS.length;
  console.log(`\n  ${total} renders · ${failures} failing assertion(s) · ${warnings} warning(s)\n`);

  if (jsonPath) {
    const absolute = path.resolve(process.cwd(), jsonPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    console.log(`  written to ${path.relative(process.cwd(), absolute)}\n`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

await main();
