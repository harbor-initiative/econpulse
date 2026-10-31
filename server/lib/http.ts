/**
 * Writing a response, in the two shapes this server produces.
 *
 * Every route calls one of these. Nothing else in the server touches `res`, so
 * there is one place to change a cache header and one place to add a header
 * later.
 */


import type { ServerResponse } from "node:http";

/**
 * Cache a success. Store nothing else.
 *
 * A 503 means the model is busy and a 404 means the place is not in this
 * release. Both can be false a minute later, and a browser that keeps either for
 * five minutes shows the next reader a failure they already retried.
 */
export function send(res: ServerResponse, code: number, body: string, type = "text/html; charset=utf-8"): void {
  const cacheable = code >= 200 && code < 300;
  res.writeHead(code, {
    "content-type": type,
    "cache-control": cacheable ? "public, max-age=300" : "no-store",
  });
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
  res.writeHead(302, { location, "cache-control": "no-store" });
  res.end();
}
