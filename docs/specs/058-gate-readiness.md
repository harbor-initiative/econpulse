# #58 — The gates must not wait on a healthy file

Parent: none · Status: draft · Found in: #24

## Problem

`scripts/lib/server.mjs` starts the app for the snapshot comparator, the design
gate and the print gate, then waits for `/healthz` to return `response.ok`.

#24 changed `/healthz` to answer **503 when the data is stale**. That is the
right answer for a monitor and the wrong signal for a tool deciding whether the
process is listening. Once the file passes 120 days, the three gates hang until
their 30-second timeout and report "the server did not answer", which points at
the server rather than at the data.

The gate would break at exactly the moment somebody needs it: when the data is
old and they are trying to measure what the pages look like.

## Approach

Readiness means the port answers a request. Correctness is what the gate is
about to measure.

Poll `/healthz`, accept any HTTP response as up, and record the status so a
failure message can say what the file claimed. Do not use `/`, because `/`
renders the whole home page on every poll.

## Acceptance criteria

- [ ] The gate treats a 503 from `/healthz` as up and measures anyway
- [ ] A stopped server still fails with a clear message
- [ ] The status the server reported is available to a failure message
- [ ] No behaviour change when the file is fresh

## Risks

A gate that starts against a genuinely broken server now waits for a route that
answers 500 rather than failing fast. The 30-second timeout still catches it.

## Out of scope

Boot-time tolerance of a corrupt database, which #24 records as open.

## Files

`scripts/lib/server.mjs`
