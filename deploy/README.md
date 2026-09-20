# Deploying Aergyle

Push to `main` → GitHub Actions builds a multi-arch image → the host pulls it
and swaps containers. The host never compiles anything.

```
push to main
   └─ Actions: build linux/amd64 + linux/arm64 on native runners
        └─ ghcr.io/markomalec/aergyle:latest  and  :<git-sha>
             └─ host: ./deploy.sh  →  pull, migrate, restart app + daemon
```

One image runs all three roles — `app`, `daemon`, `migrate` — so the Next
server and the realtime daemon can never end up on different settlement logic.

## First-time setup on a host

**1. DNS.** Point `mmo.markomalec.com` (A record) at the host's public IP.

**2. Deploy directory.** Only two files need to exist on the host:

```bash
mkdir -p ~/aergyle-deploy && cd ~/aergyle-deploy
curl -fsSLO https://raw.githubusercontent.com/MarkoMalec/aergyle/main/deploy/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/MarkoMalec/aergyle/main/deploy/deploy.sh
chmod +x deploy.sh
```

**3. Environment.** Copy `.env.example` from this directory to
`~/aergyle-deploy/.env` and fill it in. Generate the secrets:

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -base64 48   # REALTIME_TOKEN_SECRET
```

`REALTIME_TOKEN_SECRET` must match between app and daemon — they share one
`.env`, so that is automatic.

**4. Registry access.** The image is public if the repo is; if you make the
package private, log in once:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u MarkoMalec --password-stdin
```

**5. Certificate, then vhost.** Certbot needs port 80 answering for this name
*before* the vhost references a certificate that does not exist yet:

```bash
sudo certbot --apache -d mmo.markomalec.com
sudo cp mmo.markomalec.com.conf /etc/apache2/sites-available/
sudo a2ensite mmo.markomalec.com
sudo apache2ctl configtest && sudo systemctl reload apache2
```

**6. Deploy.**

```bash
cd ~/aergyle-deploy && ./deploy.sh
```

## Cutting over from the old daemon

The Pi currently runs a hand-built daemon from `~/aergyle` that binds
`0.0.0.0:3001`. It will collide with the new one, so retire it first:

```bash
cd ~/aergyle && docker compose -f docker-compose.realtime.yml down
```

Its image is from December 2025 and its checkout is behind `main`, so it has
been running stale settlement logic. Nothing of value is lost by removing it —
that drift is the reason the daemon is part of this pipeline now.

## Day to day

```bash
./deploy.sh                # latest build from main
./deploy.sh <git-sha>      # a specific build
docker compose logs -f app daemon
docker compose ps
```

**Rollback** is the same command with an older sha — every build keeps its own
immutable tag:

```bash
./deploy.sh 8167a04c1b2...
```

## Moving to a VPS

Designed for this. The whole migration:

1. Install Docker + Compose on the VPS.
2. Copy `~/aergyle-deploy/` across (`docker-compose.yml`, `deploy.sh`, `.env`).
3. Move the database — either dump and restore into a host MariaDB exactly as
   on the Pi, or run it as a container and point `DATABASE_URL` at the service
   name. If you containerise it, delete the `extra_hosts` block in
   `docker-compose.yml`; it only exists to reach a *host* MariaDB.
4. Put a reverse proxy in front. `mmo.markomalec.com.conf` works as-is on any
   Apache; for nginx or Caddy the only requirements are TLS termination,
   `/` → `127.0.0.1:3000`, and a websocket upgrade on `/ws` → `127.0.0.1:3001`.
5. Repoint DNS and run `./deploy.sh`.

No rebuild is needed even on x86, because every tag is a multi-arch manifest
covering `linux/amd64` and `linux/arm64`.

## Things worth knowing

**The websocket URL is baked in at build time.** `NEXT_PUBLIC_*` variables are
inlined into the browser bundle by `next build`, so `NEXT_PUBLIC_REALTIME_WS_URL`
is a build argument in `.github/workflows/publish.yml`, not a runtime value.
Changing the domain means re-running the workflow (use the `workflow_dispatch`
input), not editing `.env`.

**All three services share one `.env`.** The daemon imports the app's Prisma
client, which pulls in `src/env.js`, which validates the full server schema —
so the daemon needs the auth variables present even though it never uses them.

**Migrations run before the swap.** `deploy.sh` runs `prisma migrate deploy`
from the *new* image and aborts on failure, so the schema is never behind the
code that expects it.

**Ports are loopback-only** (`127.0.0.1:3000`, `127.0.0.1:3001`). Apache is the
only thing reachable from outside. Override `APP_BIND` / `WS_BIND` in `.env`
if you ever run without a proxy.

**Type errors do not block a deploy.** `next.config.js` sets
`ignoreBuildErrors`, so the workflow runs `tsc --noEmit` as an advisory job.
It reports without failing the build — tighten that once the tree is clean.
