#!/bin/sh
# Three roles out of one image. `docker compose` picks one per service.
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
  *)
    exec "$@"
    ;;
esac
