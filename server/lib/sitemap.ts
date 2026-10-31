/**
 * The sitemap, built from the file it describes.
 *
 * An index over one file per state, because 19,142 URLs in one document is a
 * document a crawler reads slowly and we regenerate expensively. One file per
 * state is also one file per FIPS prefix, so a child is a `LIKE '42%'` and not a
 * scan.
 *
 * Generated at request time and cached for the life of the process. A sitemap
 * written at build time is a sitemap that goes stale in the one file that is
 * supposed to say what exists.
 */

import type { DatabaseSync } from "node:sqlite";
import { absolute } from "./site.ts";

export interface SitemapFile {
  geoid: string;
  name: string;
}

let cache: { index: string; states: Map<string, string> } | null = null;

/** The states the file actually has places in, with their names. */
export function statesWithPlaces(db: DatabaseSync): SitemapFile[] {
  const rows = db
    .prepare("SELECT geoid, COALESCE(short_name, name) AS name FROM place WHERE kind = 'state' ORDER BY geoid")
    .all() as unknown as SitemapFile[];
  return rows;
}

function urlEntry(loc: string, lastmod: string | null, priority: string): string {
  return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<priority>${priority}</priority></url>`;
}

function document(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

function build(db: DatabaseSync) {
  const version = db.prepare("SELECT value FROM build WHERE key = 'data.version'").get() as { value?: string } | undefined;
  const lastmod = version?.value ? `${version.value.slice(0, 4)}-${version.value.slice(5, 7)}-01` : null;
  const states = new Map<string, string>();

  for (const state of statesWithPlaces(db)) {
    const places = db
      .prepare(
        `SELECT geoid FROM place
         WHERE kind IN ('county', 'place') AND substr(geoid, 1, 2) = ?
         ORDER BY geoid`,
      )
      .all(state.geoid) as unknown as Array<{ geoid: string }>;

    const entries = [
      urlEntry(absolute(`/p/${state.geoid}`), lastmod, "0.6"),
      ...places.map((row) => urlEntry(absolute(`/p/${row.geoid}`), lastmod, "0.8")),
    ];
    states.set(state.geoid, document(entries));
  }

  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...states.keys()].map((geoid) => `  <sitemap><loc>${absolute(`/sitemap/state-${geoid}.xml`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`).join("\n")}
  <sitemap><loc>${absolute("/sitemap/pages.xml")}</loc></sitemap>
</sitemapindex>
`;

  const pages = document([
    urlEntry(absolute("/"), lastmod, "1.0"),
    urlEntry(absolute("/status"), lastmod, "0.3"),
  ]);

  states.set("pages", pages);
  cache = { index, states };
  return cache;
}

/** The index document, and every child by key. */
export function sitemap(db: DatabaseSync): { index: string; states: Map<string, string> } {
  return cache ?? build(db);
}

/** Drop the cache. The tests and a data refresh both need it. */
export function resetSitemap(): void {
  cache = null;
}
