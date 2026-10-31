# #24 — Health and status answer about the data

Parent: #4 · Epic spec: [04-trust-and-reach](../remediation/specs/04-trust-and-reach.md) · Status: draft

## Problem

`/healthz` returns `{ok, data}`. That answers "did the process start", which is the
least interesting thing about a data product. It does not answer "is the file
current", which is the question that matters.

## Approach

```json
{
  "ok": true,
  "data": "2026.10",
  "built_at": "2026-10-31T00:03:55Z",
  "facts": 321295,
  "newest_fact": "2026-09",
  "oldest_retrieval": "2026-10-30",
  "stale_sources": []
}
```

`stale_sources` uses the thresholds from #13, so the monitor and the page cannot
disagree.

`/status` becomes a real page: per agency, the last retrieval date, fact count,
oldest period covered, and a fresh / aging / stale badge.

A monitor alerts on `stale_sources` non-empty, and on `built_at` older than 45
days.

## Acceptance criteria

- [ ] `/healthz` returns every field with a true value
- [ ] `stale_sources` matches what the report shows for the same source
- [ ] `/status` lists every agency with its age
- [ ] A missing table or a corrupt file returns 503, not 200

## Risks

A health check that runs a heavy query becomes a load source. These are three
`COUNT` and `MAX` queries against indexed columns.

## Out of scope

Metrics endpoints, tracing, log shipping.

## Files

`server/routes/status.ts` · `server/views/status.ts` · `server/lib/freshness.ts` · new `tests/health.test.ts`