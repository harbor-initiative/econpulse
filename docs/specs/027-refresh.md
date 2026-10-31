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

## Risks

Two paths means one rots. Both are exercised in the deploy runbook.

## Out of scope

Hot reload, zero-downtime, a control endpoint to trigger a rebuild.

## Files

`deploy/README.md` · `Dockerfile` · `compose.yaml` · `server/store.ts`