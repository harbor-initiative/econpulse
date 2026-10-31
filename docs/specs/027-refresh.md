# #27 — Refresh the data without rebuilding the image

Parent: #4 · Epic spec: [04-trust-and-reach](../remediation/specs/04-trust-and-reach.md) · Status: draft

## Problem

The database is baked into the container. Refreshing data means build, push,
restart — a ten-minute operation for a file swap. The old app refreshed with a
request.

## Approach

Two documented paths, one default:

- **Baked** (default): one artifact, nothing to mount, used by anyone who wants a
  single container.
- **Mounted** (production): `-v /srv/econpulse:/data -e ECONPULSE_DB=/data/econpulse.db`,
  so a release asset can be swapped and the container restarted.

```bash
curl -sSL -o econpulse.db.gz <release asset>
gunzip -c econpulse.db.gz > /srv/econpulse/econpulse.db.new
mv /srv/econpulse/econpulse.db.new /srv/econpulse/econpulse.db
docker restart econpulse
```

The server opens read-only at boot, so a restart is required and that is
acceptable. Watching the inode is a later optimisation.

## Acceptance criteria

- [ ] The mounted path is documented in `deploy/README.md`
- [ ] A swap and restart serves the new data version, verified by `/healthz`
- [ ] The baked path still works unchanged
- [ ] A missing database fails fast with a clear message at boot

### What changed while building it

**`ECONPULSE_DB` already worked.** `storePath()` read it before this issue, and
`openStore()` already opened read-only and failed with a message. What was
missing was the documentation, a compose example, and a proof.

**A read-only mount does not work, and this is the finding worth keeping.** The
first attempt mounted `/srv/econpulse:/data:ro` and the container restart-looped
with `unable to open database file` (SQLite error 14). The released file is in
WAL mode, so SQLite wants to create `<db>-shm` and `<db>-wal` beside it even for
a read-only connection. Mount read-write and let it; the application opens
`readOnly: true` and never writes rows.

That leaves a follow-up: the pipeline could ship the artifact in
`journal_mode=DELETE`, which would make a `:ro` mount work and make the "one
file" promise literally true. It is a build change and belongs with #11.

**The swap was proved on the deployed container.** The version string in a copy
of the file was changed, the container restarted, and `/healthz` and `/status`
both served the new value. The real file was restored and re-verified.

## Risks

Two paths means one rots. Both are exercised in the deploy runbook.

## Out of scope

Hot reload, zero-downtime, a control endpoint to trigger a rebuild.

## Files

`deploy/README.md` · `Dockerfile` · `compose.yaml` · `server/store.ts`