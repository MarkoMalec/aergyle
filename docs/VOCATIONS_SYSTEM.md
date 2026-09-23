# Vocations (Offline Actions)

This production engine powers long-running, server-authoritative “idle” actions
for both gathering vocations and crafting professions:

- Woodcutting, Mining, Fishing
- Alchemy, Blacksmithing, Weaponsmithing, Carpentry, Cooking, Tailoring, Forge

The shared crafting registry gives each profession a clear item contract:

- Blacksmithing refines ore into ingots and produces armor, tools and metal components.
- Weaponsmithing owns dedicated melee-weapon production.
- Carpentry processes logs into wooden components, bows and practical wooden items.

These professions use the same resource, requirement, timed-action and reward
paths as the existing crafting skills; they do not have profession-specific
production services.

Character bonuses used by these actions come from the canonical system in
[CHARACTER_STATS_SYSTEM.md](CHARACTER_STATS_SYSTEM.md).

Gardening uses the garden tile and harvest models. Gathering is a non-ticking,
mixed-reward expedition system. Both are documented separately in
[GARDENING_AND_GATHERING.md](GARDENING_AND_GATHERING.md).

## Core idea

The server stores a single active activity row per user (timestamps + unit time). Progress is derived from time math.

Earned units are settled by `claimVocationalRewards` (`src/server/vocations/claim.ts`): the realtime daemon calls it the moment each unit is due (see [REALTIME_WS_DAEMON.md](REALTIME_WS_DAEMON.md)), and status checks / page loads call it to catch up on anything it missed. Claims lock the activity row, so concurrent callers can't pay a unit twice. A claim grants only the units whose output fits and whose inputs are available; when nothing more can be produced it ends the activity with a reason (`INVENTORY_FULL`, `OUT_OF_MATERIALS`, `OUT_OF_BAIT`, `COMPLETED`) that the player sees as a toast or a "while you were away" summary.

## Database models

- `VocationalResource`: defines what can be produced (and the balance knobs).
  - `actionType`: which vocation (MINING, WOODCUTTING, ...)
  - `itemId`: Item template granted as the reward
  - `defaultSeconds`: base seconds per 1 unit (DB-tunable)
  - `yieldPerUnit`: items granted per unit (DB-tunable)
  - `rarity`: rarity for the granted `UserItem` stacks
  - `requiredRecipeItemId`: optional permanent learned-recipe gate
- `VocationalRequirement`: per-unit input consumption, such as bait, ore or coal
  - `itemId`: required Item template
  - `quantityPerUnit`: quantity consumed for every completed unit
- `Location`: a destination with an enforced `requiredLevel`
- `LocationVocationalResource`: optional overrides per location
  - `enabled`: allow/disable resource in a location
- `UserVocationalActivity`: one active activity per user
  - `startedAt`, `endsAt`, `unitSeconds` (snapshot), `unitsClaimed`

## API

All routes require an authenticated session.

- `GET /api/vocations/resources` → list all vocational resources
- `POST /api/vocations/start` `{ resourceId, locationId?, durationSeconds?, quantity?, baitUserItemId? }` → start an activity. `quantity` sets the duration to `quantity × unitSeconds` (still capped at 8h); the start dialog sends it for resources with inputs.
- `GET /api/vocations/status` → current activity + derived progress (settles due units first)
- `POST /api/vocations/stop` → grant what was earned, then stop the activity

There is no manual claim: `POST /api/vocations/claim` intentionally returns 404.

## Balancing workflow

1. Create/choose an `Item` template for the resource reward.
2. Create a `VocationalResource` row pointing at that `itemId`.
3. Tune speed by editing `defaultSeconds`. Woodcutting, Mining and Fishing
   shorten it with the character's matching efficiency stat:
   `unitSeconds = round(defaultSeconds × 100 / (100 + efficiency))`, minimum 1
   (`computeEffectiveUnitSeconds` in `src/game/vocationStats.ts`). Each point
   adds the same output: 100 efficiency halves the time, 200 cuts it to a
   third. The time is fixed when the activity starts.
4. Add `VocationalRequirement` rows for bait or crafting inputs.
5. Assign the resource only to destinations whose player-level requirement matches its complexity.

Tip: use Prisma Studio (`npm run db:studio`) to tweak values quickly.

The first multi-location content set is documented in [VOCATION_EXPANSION_PACK.md](VOCATION_EXPANSION_PACK.md).

Cooking's recipe gates, per-dish ingredients, and timed food effects are documented in [COOKING_SYSTEM.md](COOKING_SYSTEM.md).

Tailoring, general craftability semantics, profession item contracts and
physical blueprint requirements are documented in
[TAILORING_SYSTEM.md](TAILORING_SYSTEM.md).

Gathering deliberately does not use the tick-based start/claim routes above;
its timestamp, pool snapshots, and claim endpoint are described in
[GARDENING_AND_GATHERING.md](GARDENING_AND_GATHERING.md).
