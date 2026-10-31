/**
 * The two files a crawler asks for, and nothing else.
 *
 * A favicon is not served, and that is deliberate: a request for one is 404 like
 * any other path a reader types.
 */


import type { ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { send, sendBinary } from "../lib/http.ts";
import { db } from "../lib/runtime.ts";
import { sitemap } from "../lib/sitemap.ts";

/**
 * The only files served from disk.
 *
 * Two faces, read once at boot and held in memory. The names are a closed set so
 * a request cannot walk out of the directory, and the cache is immutable because
 * a font that changes name is a font that changes file.
 */
const FONT_DIR = path.resolve(import.meta.dirname, "..", "..", "public", "fonts");
const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "..", "public");
const FONTS = new Map<string, Buffer>();

function font(name: string): Buffer | null {
  if (!/^[a-z0-9-]+\.woff2$/.test(name)) return null;
  const cached = FONTS.get(name);
  if (cached) return cached;
  try {
    const buffer = readFileSync(path.join(FONT_DIR, name));
    FONTS.set(name, buffer);
    return buffer;
  } catch {
    return null;
  }
}

const SCRIPTS = new Map<string, Buffer>();

/** A script from `public/`, read once. The name is a closed set, like the fonts. */
function script(name: string): Buffer | null {
  if (!/^[a-z0-9-]+\.js$/.test(name)) return null;
  const cached = SCRIPTS.get(name);
  if (cached) return cached;
  try {
    const buffer = readFileSync(path.join(PUBLIC_DIR, name));
    SCRIPTS.set(name, buffer);
    return buffer;
  } catch {
    return null;
  }
}

export async function routeAssets(url: URL, res: ServerResponse): Promise<boolean> {
  if (url.pathname === "/robots.txt") {
    // A crawl delay because this is one small box, and the sitemap so a crawler
    // finds 32,000 pages in a day rather than following links for a month.
    send(res, 200, "User-agent: *\nAllow: /\nCrawl-delay: 1\nSitemap: https://econpulse.harborgovcon.com/sitemap.xml\n", "text/plain");
    return true;
  }

  if (url.pathname === "/sitemap.xml") {
    send(res, 200, sitemap(db).index, "application/xml; charset=utf-8");
    return true;
  }

  const child = url.pathname.match(/^\/sitemap\/(state-(\d{2})|pages)\.xml$/);
  if (child?.[1]) {
    const body = sitemap(db).states.get(child[1] === "pages" ? "pages" : child[2] ?? "");
    if (!body) {
      send(res, 404, "No sitemap for that state.\n", "text/plain");
      return true;
    }
    send(res, 200, body, "application/xml; charset=utf-8");
    return true;
  }

  const scriptMatch = url.pathname.match(/^\/([a-z0-9-]+\.js)$/);
  if (scriptMatch?.[1]) {
    const body = script(scriptMatch[1]);
    if (!body) return false;
    // Not immutable: the filename stays and the content changes with a deploy.
    res.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "content-length": String(body.length),
      "cache-control": "public, max-age=300",
    });
    res.end(body);
    return true;
  }

  const fontMatch = url.pathname.match(/^\/fonts\/([a-z0-9-]+\.woff2)$/);
  if (fontMatch?.[1]) {
    const body = font(fontMatch[1]);
    if (!body) return false;
    sendBinary(res, 200, body, "font/woff2");
    return true;
  }

  return false;
}
