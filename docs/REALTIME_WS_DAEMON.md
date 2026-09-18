# Realtime WS daemon (RPi/VPS)

This repo includes a standalone realtime daemon that:
- Hosts a WebSocket server (push updates to the browser)
- Runs the activity tick loop: settles every vocation unit and garden harvest tile
  the moment it is due, for every player, online or not

It is designed to run as a separate process alongside Next.js.

## What it updates

Every `VOCATION_TICK_LOOP_MS` it asks each ticker (vocations, garden harvests) which
players have something due, then settles them one player at a time:

- Vocations: `claimVocationalRewards` (`src/server/vocations/claim.ts`)
- Garden: `settleGardenHarvest` (`src/server/garden/service.ts`)

Each player is settled in their own try/catch, so one failure (or one full
inventory) never holds up anyone else. Settlement locks the activity row, so the
daemon, page loads and status checks can't pay the same tick twice.

After each settlement the player's open tabs get one `activity_tick` event
(`src/realtime/events.ts`): the new quantity of every inventory stack that changed,
whether new stacks were created, the skill whose XP moved, and a `stopReason` when
the activity ended (finished, inventory full, out of materials or bait). On
connect, clients get an `inventory_changed` hello so they can resync.

## Client side

`RealtimeBridge` applies tick events through `src/lib/player-sync.ts`:

- Stack quantities are patched straight into the cached inventory and marketplace
  sell list (`inventoryQueryKeys`), so every view updates without a refetch. New
  stacks trigger a refetch.
- The level badge and the skill's progress panel refetch.
- A stop shows a toast and refreshes the header's active action.

While the socket is connected, the header does not poll for ticks. When it is not
(daemon down, no `NEXT_PUBLIC_REALTIME_WS_URL`), the header refreshes at each unit or
tile boundary instead, and status checks settle ticks the same way.

## Requirements

- Same DB as the game (your MySQL on the RPi)
- Env vars:
  - `DATABASE_URL` (points at the same DB)
  - `REALTIME_TOKEN_SECRET` (shared secret used to sign WS auth tokens)
  - Optional: `REALTIME_WS_PORT` (default `3001`)
  - Optional: `VOCATION_TICK_LOOP_MS` (default `250`; also drives garden ticks)
  - In Next.js (browser): `NEXT_PUBLIC_REALTIME_WS_URL` (e.g. `ws://<rpi-ip>:3001` or `wss://ws.example.com`)
- Everything the daemon imports runs as plain Node, outside Next.js. Keep those
  modules (`claim.ts`, `garden/service.ts`, `harvestSchedule.ts` and what they
  import) free of `server-only` imports such as `~/server/stats`.

## Run on the RPi

1) Pull/copy the repo onto the RPi
2) Install deps: `npm install`
3) Set env vars (example):
   - `REALTIME_TOKEN_SECRET=change-me-to-a-long-random-string`
   - `REALTIME_WS_PORT=3001`
4) Start the daemon:

- `npm run realtime:daemon`

After changing tick or settlement code, rebuild/restart the daemon: an older
daemon keeps running the old settlement logic.

## Production notes

- Use TLS (`wss://`) when running over the public internet.
- Run the daemon under a process manager (`systemd`, `pm2`, Docker, etc.).
- Keep `REALTIME_TOKEN_SECRET` private (server-side only).
