# Realtime WS daemon (RPi/VPS)

This repo includes a standalone realtime daemon that:
- Hosts a WebSocket server (push updates to the browser)
- Runs a vocational tick loop (claims 1 unit exactly when due)

It is designed to run as a separate process alongside Next.js.

## What it updates

- Calls `claimVocationalRewards({ userId, maxUnits: 1 })` whenever a tick is due.
- Broadcasts events to the connected user so the UI can refresh inventory and action status.

## Requirements

- Same DB as the game (your MySQL on the RPi)
- Env vars:
  - `DATABASE_URL` (points at the same DB)
  - `REALTIME_TOKEN_SECRET` (shared secret used to sign WS auth tokens)
  - Optional: `REALTIME_WS_PORT` (default `3001`)
  - Optional: `VOCATION_TICK_LOOP_MS` (default `250`)
  - In Next.js (browser): `NEXT_PUBLIC_REALTIME_WS_URL` (e.g. `ws://<rpi-ip>:3001` or `wss://ws.example.com`)

## Run on the RPi

1) Pull/copy the repo onto the RPi
2) Install deps: `npm install`
3) Set env vars (example):
   - `REALTIME_TOKEN_SECRET=change-me-to-a-long-random-string`
   - `REALTIME_WS_PORT=3001`
4) Start the daemon:

- `npm run realtime:daemon`

## Production notes

- Use TLS (`wss://`) when running over the public internet.
- Run the daemon under a process manager (`systemd`, `pm2`, Docker, etc.).
- Keep `REALTIME_TOKEN_SECRET` private (server-side only).
