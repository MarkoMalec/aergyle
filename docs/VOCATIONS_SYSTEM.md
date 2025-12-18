# Vocations (Offline Actions)

This system powers long-running, server-authoritative “idle” actions like:
- Woodcutting, Mining, Fishing, Gathering
- Alchemy, Smelting, Cooking, Forge

## Core idea
The server stores a single active activity row per user (timestamps + unit time). Progress is derived from time math; there are no ticking jobs.

## Database models
- `VocationalResource`: defines what can be produced (and the balance knobs).
  - `actionType`: which vocation (MINING, WOODCUTTING, ...)
  - `itemId`: Item template granted as the reward
  - `defaultSeconds`: base seconds per 1 unit (DB-tunable)
  - `yieldPerUnit`: items granted per unit (DB-tunable)
  - `rarity`: rarity for the granted `UserItem` stacks
- `Location`: optional (for later)
- `LocationVocationalResource`: optional overrides per location
  - `baseSeconds`: override for that location
  - `enabled`: allow/disable resource in a location
- `UserVocationalActivity`: one active activity per user
  - `startedAt`, `endsAt`, `unitSeconds` (snapshot), `unitsClaimed`

## API
All routes require an authenticated session.
- `GET /api/vocations/resources` → list all vocational resources
- `POST /api/vocations/start` `{ resourceId, locationId?, durationSeconds? }` → start an activity
- `GET /api/vocations/status` → current activity + derived progress
- `POST /api/vocations/claim` → grant claimable rewards into inventory (stacking supported)
- `POST /api/vocations/stop` `{ claim?: boolean }` → stop activity (optionally claim first)

## Balancing workflow
1. Create/choose an `Item` template for the resource reward.
2. Create a `VocationalResource` row pointing at that `itemId`.
3. Tune speed by editing `defaultSeconds` (or `LocationVocationalResource.baseSeconds`).

Tip: use Prisma Studio (`npm run db:studio`) to tweak values quickly.
