#!/bin/sh
# Three roles (and the admin CLI) out of one image. `docker compose` picks one per service.
set -e

case "$1" in
  app)
    cd /app
    exec node server.js
    ;;
  daemon)
    cd /opt/aergyle-runtime
    exec node daemon.mjs
    ;;
  migrate)
    cd /opt/aergyle-runtime
    exec node_modules/.bin/prisma migrate deploy
    ;;
  admin)
    # /admin accounts: docker compose run --rm app admin <command> [username]
    shift
    cd /opt/aergyle-runtime
    exec node admin.mjs "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
