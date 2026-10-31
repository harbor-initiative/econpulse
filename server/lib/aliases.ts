/**
 * The alias map: how people name places, loaded once from three CSVs.
 *
 * This is a static lookup of a few hundred rows. It lives in memory because the
 * only alternative is a table, and a table would force a full data rebuild and a
 * new release artifact before "Philly" worked on the deployed site. The shipped
 * database stays untouched.
 *
 * Terms are lowercased and punctuation is stripped, so "H-Town" and "h town"
 * are the same key. A term with two different GEOIDs has no correct answer and
 * fails loudly: `npm run verify` reads the same CSVs and reports both ids.
 */


import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ALIAS_FILES = ["nicknames.csv", "states.csv", "metros.csv"] as const;
export const ALIAS_DIR = resolve(import.meta.dirname, "..", "..", "data", "aliases");

export interface AliasRow {
  term: string;
  geoid: string;
  kind: string;
}

const HEADER = "term,geoid,kind";

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeTerm(term: string): string {
  return term
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every row in the three files, in file order. */
export function readAliasRows(dir: string = ALIAS_DIR): AliasRow[] {
  const rows: AliasRow[] = [];
  for (const file of ALIAS_FILES) {
    const lines = readFileSync(resolve(dir, file), "utf8").split(/\r?\n/);
    if ((lines[0] ?? "").trim() !== HEADER) {
      throw new Error(`${file}: expected the header "${HEADER}"`);
    }
    for (let i = 1; i < lines.length; i += 1) {
      const line = (lines[i] ?? "").trim();
      if (!line) continue;
      const [term, geoid, kind] = line.split(",").map((part) => part.trim());
      if (!term || !geoid || !kind) {
        throw new Error(`${file}:${i + 1}: expected term,geoid,kind`);
      }
      rows.push({ term: normalizeTerm(term), geoid, kind });
    }
  }
  return rows;
}

/** One term, one GEOID. Two ids for one term is a hard failure. */
export function buildAliasMap(rows: AliasRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const previous = map.get(row.term);
    if (previous !== undefined && previous !== row.geoid) {
      throw new Error(`Alias "${row.term}" maps to both ${previous} and ${row.geoid}.`);
    }
    map.set(row.term, row.geoid);
  }
  return map;
}

let cache: Map<string, string> | null = null;

/** Load once per process. `store.ts` calls this at boot, before any request. */
export function loadAliases(dir: string = ALIAS_DIR): Map<string, string> {
  return (cache ??= buildAliasMap(readAliasRows(dir)));
}

/** The GEOID a human name points at, if the CSV names it. */
export function aliasGeoid(term: string): string | undefined {
  return loadAliases().get(normalizeTerm(term));
}
