#!/usr/bin/env bash
# Pull a published image and swap the running containers onto it.
#   ./deploy.sh            -> latest
#   ./deploy.sh <git-sha>  -> that exact build (also how you roll back)
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "error: no .env here. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

TAG="${1:-latest}"
export AERGYLE_TAG="$TAG"

echo "==> Pulling $TAG"
docker compose pull app daemon

# Migrations run against the new image before any new container serves
# traffic, so the schema is never behind the code that expects it.
echo "==> Applying migrations"
docker compose --profile tools run --rm migrate

echo "==> Starting app + daemon"
docker compose up -d app daemon

echo "==> Pruning images older than a week"
docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true

echo
docker compose ps
echo
echo "Deployed $TAG. Logs: docker compose logs -f app daemon"
