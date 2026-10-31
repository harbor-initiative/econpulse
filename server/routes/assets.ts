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

/**
 * The only files served from disk.
 *
 * Two faces, read once at boot and held in memory. The names are a closed set so
 * a request cannot walk out of the directory, and the cache is immutable because
 * a font that changes name is a font that changes file.
 */
const FONT_DIR = path.resolve(import.meta.dirname, "..", "..", "public", "fonts");
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

export async function routeAssets(url: URL, res: ServerResponse): Promise<boolean> {
  if (url.pathname === "/robots.txt") {
    send(res, 200, "User-agent: *\nAllow: /\n", "text/plain");
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
