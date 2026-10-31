/**
 * Writing a response, in the two shapes this server produces.
 *
 * Every route calls one of these. Nothing else in the server touches `res`, so
 * there is one place to change a cache header and one place to add a header
 * later.
 */


import type { ServerResponse } from "node:http";

export function send(res: ServerResponse, code: number, body: string, type = "text/html; charset=utf-8"): void {
  res.writeHead(code, { "content-type": type, "cache-control": "public, max-age=300" });
  res.end(body);
}

/**
 * A font, or any other byte body that never changes under the same name.
 *
 * One year and immutable: the filename is the version, so a changed face is a
 * changed name and a stale cache cannot serve the wrong glyphs.
 */
export function sendBinary(res: ServerResponse, code: number, body: Buffer, type: string): void {
  res.writeHead(code, {
    "content-type": type,
    "content-length": String(body.length),
    "cache-control": "public, max-age=31536000, immutable",
  });
  res.end(body);
}

export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { location });
  res.end();
}
