/**
 * What may be cached, and what may not.
 *
 * A cached failure is worse than a slow answer: the reader has already decided
 * to try again, and the page tells them the try already happened.
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import { send, redirect } from "../server/lib/http.ts";

function stub() {
  const record: { code: number; headers: Record<string, string>; body?: string } = { code: 0, headers: {} };
  const res = {
    writeHead(code: number, headers: Record<string, string>) {
      record.code = code;
      record.headers = headers;
      return res;
    },
    end(body?: string) {
      record.body = body;
      return res;
    },
  };
  return { res: res as unknown as ServerResponse, record };
}

test("a report is cacheable", () => {
  const { res, record } = stub();
  send(res, 200, "<html>");
  assert.equal(record.headers["cache-control"], "public, max-age=300");
});

test("a busy model is not cached", () => {
  const { res, record } = stub();
  send(res, 503, "<html>busy</html>");
  assert.equal(record.headers["cache-control"], "no-store");
});

test("a missing place is not cached", () => {
  const { res, record } = stub();
  send(res, 404, "<html>not found</html>");
  assert.equal(record.headers["cache-control"], "no-store");
});

test("a redirect is not cached", () => {
  const { res, record } = stub();
  redirect(res, "/p/42101");
  assert.equal(record.code, 302);
  assert.equal(record.headers["location"], "/p/42101");
  assert.equal(record.headers["cache-control"], "no-store");
});
