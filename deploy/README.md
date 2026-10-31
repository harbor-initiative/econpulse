# Deploy

The app is one container. It listens on port 3000 inside, and Caddy terminates
TLS in front of it.

Two hostnames point at the same container:

| Hostname | DNS | Status |
|---|---|---|
| `econpulse.porbanderwala.cloud` | `A 72.61.15.208` | live |
| `econpulse.harborgovcon.com` | **needs `A 72.61.15.208`** | blocked on DNS |

`harborgovcon.com` has a wildcard pointing at Vercel, so the subdomain resolves
to Vercel today and returns 404. An explicit `A` record for the subdomain
overrides the wildcard. That is the only missing step.

## Build and run

Build on the host. The Mac is arm64 and the server is x86_64, and an arm64 image
loads cleanly on the server and then crash-loops with `exec format error`.

```bash
ssh wala-srv '
  cd ~/econpulse && git pull
  curl -sSL -o /tmp/ep.db.gz \
    https://github.com/harbor-initiative/econpulse/releases/latest/download/econpulse-2026.10.db.gz
  gunzip -c /tmp/ep.db.gz > data/econpulse.db && rm /tmp/ep.db.gz
  docker build -t econpulse:0.2.0 .
  docker rm -f econpulse
  docker run -d --name econpulse --restart unless-stopped -p 127.0.0.1:3001:3000 econpulse:0.2.0
'
```

The database is baked into the image, so the container has nothing to fetch at
boot and works with no outbound network.

## Caddy

The vhosts live in `/etc/caddy/sites/`, imported by `/etc/caddy/Caddyfile`.

```bash
sudo cp deploy/econpulse.caddy /etc/caddy/sites/econpulse-harborgovcon.caddy
sudo -u caddy caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Validate as the `caddy` user. Running it as root creates root-owned logs and the
reload fails.

## Rollback

The previous container is kept, renamed and stopped.

```bash
ssh wala-srv '
  docker stop econpulse && docker rename econpulse econpulse-new
  docker start econpulse-legacy && docker rename econpulse-legacy econpulse
'
```

## Two ways to carry the file

The database is 110 MB and it changes on a different schedule from the code. Both
of these are supported; production uses the second.

### Baked, the default

The Dockerfile copies `data/econpulse.db` into the image. One artifact, nothing
to mount, and it works with no network at all. Refreshing the data means
rebuilding, which is the reason the second path exists.

### Mounted, production

```bash
docker run -d --name econpulse --restart unless-stopped \
  -p 127.0.0.1:3001:3000 \
  -v /srv/econpulse:/data:ro \
  -e ECONPULSE_DB=/data/econpulse.db \
  econpulse:0.11.0
```

The server opens the file read-only at boot, so a swap needs a restart and that
is acceptable: a restart is two seconds and a rebuild is ten minutes.

## Refreshing the data without a rebuild

```bash
ssh wala-srv '
  set -e
  curl -sSL -o /tmp/econpulse.db.gz \
    https://github.com/harbor-initiative/econpulse/releases/latest/download/econpulse-2026.10.db.gz
  gunzip -c /tmp/econpulse.db.gz > /srv/econpulse/econpulse.db.new
  mv /srv/econpulse/econpulse.db.new /srv/econpulse/econpulse.db
  docker restart econpulse
  sleep 3
  curl -s http://127.0.0.1:3001/healthz
'
```

`mv` rather than a write in place, so the container never opens a half-written
file. The restart is what picks the new one up.

## County outlines

`data/boundaries/` is build output and is not in the repository. The image copies
it, so the host must have it before `docker build`:

```bash
ssh wala-srv 'cd ~/econpulse && node scripts/fetch-boundaries.mjs'
```

Fifty-two states, about 16 MB, four minutes. No key, and the geometry only changes
when the Census republishes. A build without it succeeds and every map draws its
"No WebGL" fallback, which is the wrong kind of quiet.

## Checks after a deploy

```bash
curl -s https://econpulse.harborgovcon.com/healthz
curl -s https://econpulse.harborgovcon.com/p/42101 | grep -o '<title>[^<]*'
```

The health check returns the data version, which is the number that tells you
whether the file inside the container is the one you meant to ship. It also
returns the age in days and the band, so a swap that served an old file shows up
in the same request.
