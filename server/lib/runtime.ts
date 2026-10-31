/**
 * The open database handle and the build record, opened once per process.
 *
 * One connection for the whole server. `node:sqlite` is synchronous, so a second
 * handle would buy nothing and would double the memory for no reason.
 */


import { readFileSync } from "node:fs";
import path from "node:path";
import { allPlaces, openStore, storePath, buildMeta } from "../store.ts";
import { buildSearchIndex } from "./search-index.ts";

/** The version this process is running, read from package.json at boot. */
export const appVersion: string = (() => {
  try {
    const raw = readFileSync(path.resolve(import.meta.dirname, "..", "..", "package.json"), "utf8");
    return String((JSON.parse(raw) as { version?: string }).version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
})();

export const db = openStore(storePath());
export const meta = buildMeta(db);

// The search index reads every place once. The build is logged with its size
// and timing, so a slow or fat index shows up in the boot log.
buildSearchIndex(allPlaces(db));
