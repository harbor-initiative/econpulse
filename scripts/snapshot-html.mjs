#!/usr/bin/env node
/**
 * Capture or compare the rendered HTML of every route.
 *
 *   node scripts/snapshot-html.mjs            write tests/snapshot-html/
 *   node scripts/snapshot-html.mjs --check    compare against the committed copy
 *
 * A refactor that changes an answer is not a refactor. This is the guard that
 * catches one. It boots the server itself, so it never tests a stale process,
 * and it runs with the model switched off so the output is deterministic.
 *
 * The model path is excluded on purpose. A model answer is non-deterministic by
 * nature, so it cannot be compared byte for byte; the route is captured with the
 * key absent, which exercises the "which place" state instead.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { repoRoot, startServer } from "./lib/server.mjs";

const ROOT = repoRoot();
const OUT = path.join(ROOT, "tests", "snapshot-html");

/** The routes the split must not disturb. */
const ROUTES = [
  { slug: "home", path: "/" },
  { slug: "place-county", path: "/p/42101" },
  { slug: "place-city", path: "/p/4260000" },
  { slug: "ask-local", path: "/ask?q=Population+of+Cook+County" },
  { slug: "ask-question", path: "/ask?q=Is+rent+going+up+in+Austin" },
  { slug: "search", path: "/s?q=Phila" },
  { slug: "status", path: "/status" },
  { slug: "not-found", path: "/nope" },
  { slug: "healthz", path: "/healthz" },
  { slug: "robots", path: "/robots.txt" },
];

const check = process.argv.includes("--check");

/**
 * The clock the baseline was captured against.
 *
 * `/healthz` and `/status` print an age in days, so their HTML changes every
 * morning. Pinning the clock here makes the comparison about the code rather
 * than about the date — and a gate that fails for a reason nobody changed is a
 * gate that gets ignored.
 */
const PINNED_NOW = process.env.ECONPULSE_NOW ?? "2026-10-31T12:00:00Z";

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** First byte that differs, with a little context, so a failure is readable. */
function describeDifference(expected, actual) {
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i += 1;
  const line = expected.slice(0, i).split("\n").length;
  const from = Math.max(0, i - 60);
  return [
    `first difference at byte ${i} (line ${line})`,
    `  expected: ${JSON.stringify(expected.slice(from, i + 60))}`,
    `  actual:   ${JSON.stringify(actual.slice(from, i + 60))}`,
  ].join("\n");
}

async function main() {
  const server = await startServer({ port: process.env.SNAPSHOT_PORT ?? 3198, env: { ECONPULSE_NOW: PINNED_NOW } });
  const failures = [];
  const index = {};
  console.log(`  clock ${PINNED_NOW}`);

  try {
    await mkdir(OUT, { recursive: true });

    for (const route of ROUTES) {
      // Bounded. A server that accepts a connection and never answers used to
      // hang this script for the length of undici's default timeout, per route.
      const response = await fetch(`${server.base}${route.path}`, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
      const body = await response.text();
      index[route.slug] = {
        status: response.status,
        type: response.headers.get("content-type"),
        bytes: body.length,
      };

      if (check) {
        const expectedFile = path.join(OUT, `${route.slug}.html`);
        if (!existsSync(expectedFile)) fail(`no snapshot for ${route.slug}. Run without --check first.`);
        const expected = await readFile(expectedFile, "utf8");
        if (expected !== body) {
          failures.push(`  ${route.slug.padEnd(14)} ${route.path}\n${describeDifference(expected, body)}`);
          continue;
        }
        console.log(`  ok    ${route.slug.padEnd(14)} ${String(response.status).padEnd(4)} ${body.length} bytes`);
      } else {
        await writeFile(path.join(OUT, `${route.slug}.html`), body, "utf8");
        console.log(`  wrote ${route.slug.padEnd(14)} ${String(response.status).padEnd(4)} ${body.length} bytes`);
      }
    }

    if (check) {
      const expectedIndex = JSON.parse(await readFile(path.join(OUT, "index.json"), "utf8"));
      const actual = JSON.stringify(index, null, 2);
      if (actual !== JSON.stringify(expectedIndex, null, 2)) {
        failures.push(`  index.json\n${describeDifference(JSON.stringify(expectedIndex, null, 2), actual)}`);
      }
      if (failures.length) {
        console.error(`\n${failures.length} route(s) changed:\n\n${failures.join("\n\n")}\n`);
        process.exit(1);
      }
      console.log("\n  every route renders identically.\n");
    } else {
      await writeFile(path.join(OUT, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
      console.log(`\n  ${ROUTES.length} routes captured to ${path.relative(ROOT, OUT)}/\n`);
    }
  } finally {
    server.stop();
  }
}

await main();
