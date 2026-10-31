#!/usr/bin/env node
/**
 * The print gate.
 *
 * Print is the only export, by decision, and nothing has ever looked at it. A
 * browser print of the old page cut panels across page boundaries and dropped
 * the footer, and nobody found out because nobody prints a web app while
 * building one.
 *
 * Two measurements, because they catch different failures. Print media in the
 * live DOM says whether the rules applied: one column, no split panels, no
 * interactive furniture. A real PDF says whether that produced a page a person
 * can hold.
 */

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { findChrome, launchChrome, openPage } from "./lib/cdp.mjs";
import { startServer } from "./lib/server.mjs";

const ROUTE = process.argv.includes("--route") ? process.argv[process.argv.indexOf("--route") + 1] : "/p/42101";
const problems = [];

function check(label, ok, detail) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(44)} ${detail}`);
  if (!ok) problems.push(`${label}: ${detail}`);
}

const chrome = findChrome();
if (!chrome) {
  console.log("\n  no Chrome, so the print gate was skipped\n");
  process.exit(process.env.CI ? 1 : 0);
}

const server = await startServer({ port: process.env.PRINT_PORT ?? 3308 });
const browser = await launchChrome(chrome);

try {
  const page = await openPage(browser.url);
  await page.setViewport(1440, 900);
  await page.goto(`${server.base}${ROUTE}`);
  await page.evaluate("document.fonts.ready.then(() => true)");
  await page.setMedia("print");

  const measured = await page.evaluate(`(() => {
    const one = (el) => el ? getComputedStyle(el) : null;
    const grid = one(document.querySelector(".grid"));
    const panel = one(document.querySelector(".metric"));
    const dock = one(document.querySelector(".dock"));
    const topbar = one(document.querySelector(".topbar"));
    const table = one(document.querySelector(".chart-table"));
    const footer = document.querySelector("footer");
    return {
      columns: grid ? grid.display : null,
      breakInside: panel ? panel.breakInside : null,
      dock: dock ? dock.display : null,
      topbar: topbar ? topbar.display : null,
      tables: table ? table.display : null,
      footer: footer ? footer.textContent.replace(/\\s+/g, " ").trim() : "",
    };
  })()`);

  check("panels stack in one column", measured.columns === "block", `grid display ${measured.columns}`);
  check("a panel never splits a page", measured.breakInside === "avoid", `break-inside ${measured.breakInside}`);
  check("the search field is not printed", measured.dock === "none", `dock display ${measured.dock}`);
  check("the top bar is not printed", measured.topbar === "none", `topbar display ${measured.topbar}`);
  check("open tables are not printed", measured.tables === "none", `details display ${measured.tables}`);
  check("the footer carries the data version", /data \d{4}\.\d{2}/.test(measured.footer), measured.footer.slice(0, 78));
  check("the footer carries the app version", /app \d+\.\d+\.\d+/.test(measured.footer), "app version");
  check("the footer carries the address", /econpulse\.harborgovcon\.com/.test(measured.footer), "URL");

  const pdf = await page.pdf();
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  const artefact = path.join(tmpdir(), "econpulse-print-check.pdf");
  writeFileSync(artefact, pdf);
  check("the PDF is at least one page", pages >= 1, `${pages} page(s), ${Math.round(pdf.length / 1024)} KB, ${artefact}`);
  check("the PDF does not run away", pages <= 6, `${pages} page(s)`);

  page.close();
} finally {
  await browser.close();
  server.stop();
}

console.log(`\n  ${problems.length ? `${problems.length} failing check(s)` : "print checks passed"}\n`);
process.exit(problems.length ? 1 : 0);
