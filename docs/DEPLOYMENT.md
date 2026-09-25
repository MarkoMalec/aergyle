# Deployment

Aergyle runs at **https://mmo.markomalec.com** on a Raspberry Pi 5 that is
treated as an ordinary Linux server. Nothing in this pipeline is Pi-specific —
moving to a VPS is a copy, not a rewrite.

```
git push origin main
  └─ GitHub Actions (.github/workflows/publish.yml)
       ├─ build linux/amd64  on ubuntu-24.04      ~4m
       ├─ build linux/arm64  on ubuntu-24.04-arm  ~4m   (native, no emulation)
       └─ merge into one multi-arch manifest       ~10s
            └─ ghcr.io/markomalec/aergyle:latest  +  :<git-sha>
                 └─ on the host: ~/aergyle-deploy/deploy.sh
                      ├─ docker compose pull
                      ├─ prisma migrate deploy   (from the NEW image)
                      └─ restart app + daemon
```

The host never compiles anything. It holds three files: `docker-compose.yml`,
`deploy.sh` and `.env`.

## Quick reference

```bash
# Deploy the newest build from main
ssh malec.ddns.net 'cd ~/aergyle-deploy && ./deploy.sh'

# Deploy (or roll back to) a specific build
ssh malec.ddns.net 'cd ~/aergyle-deploy && ./deploy.sh 6a9b924'

# Watch it
ssh malec.ddns.net 'cd ~/aergyle-deploy && docker compose logs -f app daemon'

# What is running
ssh malec.ddns.net 'cd ~/aergyle-deploy && docker compose ps'
```

`deploy.sh` pulls the **image** only. When `deploy/docker-compose.yml` changes
in the repo (a new volume, a new service), refresh the host's copy first:

```bash
cd ~/aergyle-deploy && curl -fsSLO \
  https://raw.githubusercontent.com/MarkoMalec/aergyle/main/deploy/docker-compose.yml
```

SSH is on **port 6666**, not 22. The `malec.ddns.net` entry in `~/.ssh/config`
already sets this. On the LAN, `ssh -p 6666 malec@192.168.1.67` is the same
machine with far lower latency.

## For AI agents

Rules that are easy to break and expensive to debug:

1. **Never add a second place that builds the app.** One `Dockerfile`, three
   roles (`app`, `daemon`, `migrate`) dispatched by `docker-entrypoint.sh`. The
   Next server and the realtime daemon *must* come from the same image — they
   share settlement logic, and a drift between them silently pays players twice
   or not at all. This pipeline exists because exactly that happened.
2. **`NEXT_PUBLIC_*` is build-time, not runtime.** `next build` inlines it into
   the browser bundle. `NEXT_PUBLIC_REALTIME_WS_URL` is a `--build-arg` in the
   workflow. Putting it in `.env` on the host does nothing.
3. **`output: "standalone"` makes `sharp` mandatory.** Without it Next does not
   fall back to WASM — it throws and serves the full-size original for every
   `next/image` request. See Troubleshooting.
4. **The daemon is bundled as ESM, not CJS.** The generated Prisma client reads
   `import.meta.url`, which a CJS bundle turns into `undefined` and crashes on
   startup.
5. **Migrations run from the new image, before the swap.** Do not reorder
   `deploy.sh`.
6. **Do not commit `.env`.** Secrets live only in `~/aergyle-deploy/.env` on the
   host (chmod 600) and in the developer's local `.env`.
7. **Verify against the live URL, not the container.** `curl -s -o /dev/null -w
   "%{http_code}" https://mmo.markomalec.com/` exercises TLS, Apache and the
   app together.

## How the build works

`Dockerfile` has five stages:

| Stage | Purpose |
|---|---|
| `base` | node:22-bookworm-slim + openssl; sets a placeholder `DATABASE_URL` so `prisma generate` runs without a database |
| `deps` | `npm ci` (full, including dev) — postinstall generates the Prisma client |
| `runtime-deps` | A separate ~148-package tree holding only the Prisma CLI, the MariaDB driver and dotenv. Versions are read out of the real `package.json` so they cannot drift |
| `builder` | `prisma generate`, `next build`, and an esbuild bundle of the realtime daemon |
| `runner` | Next standalone output in `/app`, migrations + daemon in `/opt/aergyle-runtime`, running as the `node` user |

Two dependency trees exist on purpose. `/app/node_modules` is whatever Next
traced for the server; `/opt/aergyle-runtime/node_modules` is the small tree the
daemon and the Prisma CLI need. Keeping them apart stops a Next tracing change
from silently breaking migrations.

The image is ~605 MB, down from 1.38 GB before standalone output.

### Build times (measured)

| Where | Cold | Cached |
|---|---|---|
| GitHub Actions, arm64 native | 3m37s | — |
| GitHub Actions, amd64 native | 4m15s | — |
| Directly on the Pi | 2m19s | 7s |

## Environment variables

One `.env` on the host is shared by all three services. The daemon imports the
app's Prisma client, which pulls in `src/env.js` and validates the **full**
server schema — so the daemon needs the auth variables present even though it
never uses them. `deploy/.env.example` documents every key.

The single exception is `NEXT_PUBLIC_REALTIME_WS_URL`, which is baked in at
build time. Changing the public domain means re-running the workflow (use the
`workflow_dispatch` input), not editing `.env`.

## First-time setup on a new host

1. **DNS** — point the hostname at the server's public IP.
2. **Deploy directory**

   ```bash
   mkdir -p ~/aergyle-deploy && cd ~/aergyle-deploy
   BASE=https://raw.githubusercontent.com/MarkoMalec/aergyle/main/deploy
   curl -fsSLO $BASE/docker-compose.yml
   curl -fsSLO $BASE/deploy.sh && chmod +x deploy.sh
   curl -fsSLO $BASE/mmo.markomalec.com.conf
   ```

3. **Environment** — copy `deploy/.env.example` to `.env`, fill it in,
   `chmod 600 .env`. Generate secrets with `openssl rand -base64 32`.
4. **Certificate**, using a temporary HTTP vhost for the ACME challenge, because
   the real vhost references a certificate that does not exist yet:

   ```bash
   # minimal *:80 vhost with ServerName + DocumentRoot /var/www/html, enable it,
   # apache2ctl configtest && systemctl reload apache2, then:
   sudo certbot certonly --webroot -w /var/www/html -d mmo.markomalec.com
   # then disable the temporary vhost and install the real one
   ```

5. **Reverse proxy** — `deploy/mmo.markomalec.com.conf`. Always
   `sudo apache2ctl configtest` before `systemctl reload apache2`; this box
   serves other sites.
6. **Deploy** — `./deploy.sh`.

### Discord OAuth

The callback URL must be registered in the Discord Developer Portal or login
fails with an invalid-redirect error:

```
https://mmo.markomalec.com/api/auth/callback/discord
```

### Admin access

`/admin` has its own accounts, separate from player accounts. Signing in at
`/admin/login` takes a username, a password and a 6-digit code from an
authenticator app (Authy, 1Password, Google Authenticator...). Accounts are
managed from a terminal that can reach the database:

```
npm run admin -- create <username>   # password, then scan the QR code
npm run admin -- reset <username>    # new password + authenticator, ends all sessions
npm run admin -- disable <username>  # blocks sign-in, ends all sessions
npm run admin -- unlock <username>   # after 5 failed attempts (15 min lock)
npm run admin -- list
```

Sessions are server-side (the cookie holds a random token; only its SHA-256 is
stored), last 8 hours, and end after an hour of inactivity. Every sign-in and
every change made through `/admin` is written to the audit log, visible under
`/admin/security`, where you can also end your other sessions.

## Images

`next/image` is used in 43 files and plain `<img>` in none, so server-side image
optimization is on the critical path for the whole UI. Three things make it work:

1. **`sharp` is a hard dependency**, not an optional one. `output: "standalone"`
   removes Next's WASM fallback — without sharp the optimizer throws and serves
   the untouched original, which looks fine and quietly ships megabytes.
2. **`images.minimumCacheTTL` is 30 days** in `next.config.js`. The default is
   60 seconds, which discards every optimized variant a minute after building
   it. Game art is versioned in the filename (`-v1`, `-v2`), so a long TTL is
   safe; bump the suffix when art changes.
3. **The optimized cache is a named volume** (`image-cache` →
   `/app/.next/cache`). Without it every deploy starts from an empty cache and
   the host re-optimizes all 200+ assets on first request.

Measured effect of sharp on one 876 KB source PNG:

| Request | Without sharp | With sharp |
|---|---|---|
| `w=16` | 896,699 B | 582 B |
| `w=64` | 896,699 B | 3,843 B |
| `w=64`, WebP | — | 3,542 B |

**The source assets are still the real problem.** 217 files, 69 MB, with
individual inventory icons at 1.8 MB. Optimization is compensating for art that
was never downsized. Pre-processing those once would cut the image directory by
roughly an order of magnitude and reduce the work sharp does per request.

## Moving to a VPS

1. Install Docker and Compose.
2. Copy `~/aergyle-deploy/` across — `docker-compose.yml`, `deploy.sh`, `.env`.
3. Move the database. Either keep MariaDB as a host service exactly as on the
   Pi, or run it as a container and point `DATABASE_URL` at the service name —
   in which case delete the `extra_hosts` block from `docker-compose.yml`, which
   exists only to reach a *host* MariaDB.
4. Put a reverse proxy in front. The Apache vhost works as-is; nginx or Caddy
   need only TLS termination, `/` → `127.0.0.1:3000`, and a websocket upgrade on
   `/ws` → `127.0.0.1:3001`.
5. Repoint DNS, re-run the workflow if the domain changed (see
   `NEXT_PUBLIC_REALTIME_WS_URL` above), then `./deploy.sh`.

No rebuild is needed on x86: every tag is a multi-arch manifest.

## Troubleshooting

**Images load but are huge / every size returns identical bytes.** `sharp` is
missing. In standalone mode Next does not fall back to WASM — it throws, logs
`'sharp' is required to be installed in standalone mode`, and serves the raw
original. Check with:

```bash
for w in 16 256; do curl -s -o /dev/null -w "w=$w %{size_download}\n" \
  "https://mmo.markomalec.com/_next/image?url=%2Fassets%2Fui%2Fcoins-icon.png&w=$w&q=75"; done
```

Different byte counts mean it is working.

**Daemon exits immediately with `ERR_INVALID_ARG_TYPE ... fileURLToPath`.** The
esbuild bundle was produced as CJS. It must be `--format=esm` with a
`createRequire` banner.

**`EACCES` writing `.next/cache`.** The runner runs as `node`; the copied tree
must be `--chown=node:node`.

**Port 3001 already in use.** An older hand-built daemon from `~/aergyle` is
still running: `cd ~/aergyle && docker compose -f docker-compose.realtime.yml down`.

**Migrations fail with P1001 can't reach database.** Inside a container
`localhost` is the container. Use `host.docker.internal`, which
`docker-compose.yml` maps to the host gateway.

**`tsc --noEmit` fails in CI.** This blocks the build on purpose. `next.config.js`
sets `ignoreBuildErrors`, so `next build` will compile broken TypeScript
happily — the typecheck job is the only thing between a type error and the Pi.
Fix the error rather than bypassing the gate.

Note `next-env.d.ts` is gitignored and only regenerated by running `next`, which
is why `types/next-images.d.ts` is committed: without it CI fails on the tree's
one `import … from "*.png"` rather than on anything real.

## Related

- `deploy/` — the files that live on the host
- `docs/REALTIME_WS_DAEMON.md` — what the daemon does and why it must match the app
