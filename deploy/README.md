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

## Checks after a deploy

```bash
curl -s https://econpulse.porbanderwala.cloud/healthz
curl -s https://econpulse.porbanderwala.cloud/p/42101 | grep -o '<title>[^<]*'
```

The health check returns the data version, which is the number that tells you
whether the file inside the container is the one you meant to ship.
