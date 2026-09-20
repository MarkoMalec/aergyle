# syntax=docker/dockerfile:1.7

# One image, three roles (app / daemon / migrate) so the Next server and the
# realtime daemon can never drift onto different settlement logic again.
# Nothing here is Raspberry Pi specific: it builds for linux/amd64 and
# linux/arm64 alike, so moving to a VPS is a pull, not a rebuild.

ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------- base
FROM node:${NODE_VERSION} AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
# Prisma's config reads env("DATABASE_URL") even for codegen, which never
# connects. A placeholder keeps `prisma generate` happy at build time.
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build" \
    SKIP_ENV_VALIDATION=1 \
    NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------- deps
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall runs `prisma generate`, which needs the schema above.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

# ------------------------------------------------------- runtime-deps
# A deliberately tiny dependency tree for the two things the lean runner
# still needs at runtime: the Prisma CLI (migrations) and the MariaDB
# driver (the daemon bundle leaves these external). Versions are read from
# the real package.json so this can never drift from the app.
FROM base AS runtime-deps
WORKDIR /rt
COPY package.json ./source-package.json
RUN node -e "\
const p = require('./source-package.json'); \
const pick = (n) => p.dependencies[n] ?? p.devDependencies[n] ?? (() => { throw new Error('missing dep: ' + n) })(); \
require('fs').writeFileSync('package.json', JSON.stringify({ \
  name: 'aergyle-runtime', private: true, \
  dependencies: { \
    prisma: pick('prisma'), \
    mariadb: pick('mariadb'), \
    '@prisma/adapter-mariadb': pick('@prisma/adapter-mariadb'), \
    dotenv: pick('dotenv'), \
  }, \
}, null, 2))" \
 && rm source-package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --omit=optional --no-audit --no-fund

# ------------------------------------------------------------- builder
FROM base AS builder
COPY --from=deps /src/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# the websocket URL has to be known here rather than at `docker run`.
ARG NEXT_PUBLIC_REALTIME_WS_URL
ENV NEXT_PUBLIC_REALTIME_WS_URL=${NEXT_PUBLIC_REALTIME_WS_URL}

RUN npx prisma generate
RUN npm run build

# The daemon is TypeScript run through tsx in dev. Bundling it here means the
# runner needs neither tsx nor the full source tree. esbuild resolves the
# "~/*" tsconfig paths itself. mariadb/the adapter stay external because they
# reach for optional native bindings that do not survive bundling.
# ESM, not CJS: the generated Prisma client reads import.meta.url, which a CJS
# bundle turns into undefined. The banner restores `require` for the handful of
# bundled CommonJS deps that still reach for it.
RUN npx esbuild src/realtime/daemon.ts \
      --bundle --platform=node --format=esm --target=node22 \
      --external:mariadb --external:@prisma/adapter-mariadb \
      --tsconfig=tsconfig.json \
      --banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);" \
      --outfile=/tmp/daemon.mjs

# -------------------------------------------------------------- runner
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Undo the build-time placeholder so a missing DATABASE_URL fails loudly
# instead of silently pointing at nothing.
ENV DATABASE_URL=""
ENV SKIP_ENV_VALIDATION=""

# The Next standalone server and its traced dependencies. Owned by `node`
# because the image optimizer writes its cache under .next at runtime.
WORKDIR /app
COPY --from=builder --chown=node:node /src/.next/standalone ./
COPY --from=builder --chown=node:node /src/.next/static ./.next/static
COPY --from=builder --chown=node:node /src/public ./public
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next

# Migrations and the daemon live outside /app so their dependency tree stays
# separate from the one Next traced for the app.
WORKDIR /opt/aergyle-runtime
COPY --from=runtime-deps /rt/node_modules ./node_modules
COPY --from=builder /src/prisma ./prisma
COPY --from=builder /src/prisma.config.ts ./prisma.config.ts
COPY --from=builder /tmp/daemon.mjs ./daemon.mjs

COPY docker-entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

USER node
EXPOSE 3000 3001
ENTRYPOINT ["/usr/local/bin/entrypoint"]
CMD ["app"]
