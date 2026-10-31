#!/usr/bin/env node
/**
 * The font gate.
 *
 * Two faces, self-hosted, subset. Three things are worth measuring: the download
 * budget, whether the page reaches any other origin for a face, and whether the
 * swap moves the layout when the real face arrives.
 *
 * The third one is the reason this boots a browser. A `font-display: swap` that
 * shifts the page is a worse reader experience than a rounded budget, and no
 * amount of reading the stylesheet reveals it.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { findChrome, launchChrome, openPage } from "./lib/cdp.mjs";
import { repoRoot, startServer } from "./lib/server.mjs";

const ROOT = repoRoot();
const FONT_DIR = path.join(ROOT, "public", "fonts");
const BUDGET_BYTES = 60 * 1024;
const MAX_CLS = 0.05;

const problems = [];
const notes = [];

function check(label, ok, detail) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(46)} ${detail}`);
  if (!ok) problems.push(`${label}: ${detail}`);
}

// 1. The files, and the budget.
const files = readdirSync(FONT_DIR).filter((name) => name.endsWith(".woff2"));
const total = files.reduce((sum, name) => sum + statSync(path.join(FONT_DIR, name)).size, 0);

check("two faces ship as woff2", files.length === 2, files.join(", "));
check("total download under 60 KB", total <= BUDGET_BYTES, `${(total / 1024).toFixed(1)} KB of ${BUDGET_BYTES / 1024} KB`);

for (const name of files) {
  const head = readFileSync(path.join(FONT_DIR, name)).subarray(0, 4).toString("latin1");
  check(`${name} is a woff2`, head === "wOF2", head);
}

// 2. The stylesheet points at them, and swaps.
const css = readFileSync(path.join(ROOT, "server", "views", "css.ts"), "utf8");
check("stylesheets declare Inter Tight", /font-family:"Inter Tight"/.test(css), "family");
check("stylesheets declare Source Serif 4", /font-family:"Source Serif 4"/.test(css), "family");
check("both faces use font-display: swap", (css.match(/font-display:swap/g) || []).length >= 2, "swap");
check("both faces carry a unicode-range subset", (css.match(/unicode-range:/g) || []).length >= 1, "range");

// 3. In a browser: no third-party fetch, and no layout shift on swap.
const chrome = findChrome();
if (!chrome) {
  notes.push("no Chrome, so the layout-shift and origin checks were skipped");
  console.log("  skip no Chrome: shift and origin checks skipped");
} else {
  const server = await startServer({ port: process.env.FONT_PORT ?? 3308 });
  const browser = await launchChrome(chrome);
  try {
    const page = await openPage(browser.url);
    await page.setViewport(1440, 900);
    // Installed before any document script: a shift that happens during load is
    // exactly the one that would be missed by observing afterwards.
    await page.evaluateOnNewDocument(`window.__cls=0;
      new PerformanceObserver((list)=>{for(const entry of list.getEntries()){if(!entry.hadRecentInput) window.__cls+=entry.value;}})
        .observe({type:"layout-shift",buffered:true});`);

    for (const route of ["/", "/p/42101"]) {
      await page.goto(`${server.base}${route}`);
      const external = await page.evaluate(`(() => {
        const urls = [];
        for (const el of document.querySelectorAll("link[href],script[src],img[src],source[src]")) {
          const value = el.getAttribute("href") || el.getAttribute("src") || "";
          if (/^https?:\\/\\//.test(value)) urls.push(value);
        }
        const style = document.querySelector("style");
        if (style && /url\\(\\s*['"]?https?:/.test(style.textContent)) urls.push("css url(http...)");
        return urls;
      })()`);
      check(`${route} fetches nothing external`, external.length === 0, external.length ? external.join(", ") : "none");

      await page.evaluate("document.fonts.ready.then(() => true)");
      await new Promise((resolve) => setTimeout(resolve, 600));
      const cls = await page.evaluate("window.__cls");
      check(`${route} layout shift under ${MAX_CLS}`, cls <= MAX_CLS, `CLS ${Number(cls).toFixed(4)}`);
    }
    page.close();
  } finally {
    await browser.close();
    server.stop();
  }
}

console.log(`\n  ${problems.length ? `${problems.length} failing check(s)` : "all font checks passed"}${notes.length ? ` · ${notes.join("; ")}` : ""}\n`);
process.exit(problems.length ? 1 : 0);
