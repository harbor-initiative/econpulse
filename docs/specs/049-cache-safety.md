# #49 — A failure must not be cached for five minutes

Parent: none · Status: draft · Found in: review of #19

## Problem

`server/lib/http.ts` stamps `cache-control: public, max-age=300` on every
response, including the ones that are true for a moment.

| Response | Why the header is wrong |
|---|---|
| `503` Model unavailable | A transient condition. A reader who retries sees the cached failure, and a reader who retries is the one who needs the retry. |
| `404` Not found | A place added by the next data release stays 404 in a browser that asked before it existed. |
| `302` redirect | Pins a target for five minutes after the target changes on purpose. |

The header was written when the only responses were reports, and every response
was a report. It is one line, it is wrong, and nothing has caught it because
nothing measured caching.

## Approach

Cache a success. Store nothing else.

```ts
const cacheable = code >= 200 && code < 300;
res.writeHead(code, {
  "content-type": type,
  "cache-control": cacheable ? "public, max-age=300" : "no-store",
});
```

`sendBinary` keeps its immutable header: a font file is addressed by name and
the name changes when the font does.

## Acceptance criteria

- [ ] A 2xx response carries `public, max-age=300`
- [ ] A 4xx or 5xx response carries `no-store`
- [ ] A redirect carries `no-store`
- [ ] The 503 from #19 is not cached by a browser
- [ ] A test asserts all three cases without a server, by calling `send` with a stub response

## Risks

A `no-store` 404 costs the reader a round trip they would otherwise have saved.
They asked for a page that does not exist; a second question is cheaper than a
stale answer.

## Out of scope

ETags, conditional requests, `stale-while-revalidate`, CDN configuration.

## Files

`server/lib/http.ts` · new `tests/http.test.ts`
