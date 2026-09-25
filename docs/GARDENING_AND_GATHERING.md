# Gardening and Gathering

Gardening and Gathering are deliberately separate skills with different player
rhythms:

- **Gardening:** plant a seed in an individual plot, wait for it to grow, then
  harvest the ready crop.
- **Gathering:** gather from the character's current atlas location for a
  configured duration, then claim a randomized mixed haul on return. Reaching
  another pool requires travelling there first.

The split preserves existing gardens and copies legacy Gathering progression to
Gardening during migration. Gathering starts as a distinct level-one expedition
track so the old garden progression is never silently reinterpreted as expedition
progression.

## Gardening

The existing garden models remain the source of truth. No replacement farming
subsystem was introduced.

- `Item` seed fields configure growth time, harvest time, yield item, yield range,
  and Gardening XP.
- `UserGardenTile` snapshots those values at planting, so later admin edits do not
  change crops already in the ground.
- `UserGardenHarvestActivity` remains the timestamp-based batch harvest action.
  Its `tiles` JSON is the harvest schedule (tile order, harvest seconds, yield
  item, harvested flag), snapshotted at start.
- Tiles pay out one at a time as each tile's bar fills: its rolled yield,
  character XP and `GARDENING` skill XP are granted and the tile is cleared. The
  realtime daemon settles tiles live; status checks and the garden page settle
  anything it missed. If a tile's yield doesn't fit in the inventory, the harvest
  stops and the remaining tiles stay planted. Cancelling keeps finished tiles.

The player page is `/skills/Gardening`; seed balance lives at
`/admin/gardening`.

## Gathering expeditions

Gathering reuses the existing `Location`, `VocationalResource`, item, rarity,
inventory, character-stat, equipment-stat, food-effect, XP, and skill-progression
systems.

- `Location.gatheringEnabled` and `gatheringRequiredLevel` make existing world
  locations gatherable. Departure always derives the location from
  `User.currentLocationId`; the client cannot select or submit a destination.
- `VocationalResource` rows with `actionType = GATHERING` define potential finds,
  their item template, rarity, and per-resource skill gate.
- `LocationVocationalResource` assigns resources to a location and stores base
  find chance plus minimum and maximum quantity.
- `GatheringDuration` stores the player-facing duration choices, required
  Gathering level, find-roll count, quantity multiplier, XP, availability, and
  display order.
- `UserGatheringExpedition` stores one expedition per character and snapshots the
  location pool, duration balance, Gathering level, Luck, and Gathering
  Efficiency at departure.

Because the expedition stores snapshots, a live journey remains fair and
deterministic with respect to balance inputs even if an administrator edits the
location while the character is away. The final random rolls happen once when
the completed journey is claimed.

## Reward calculation

Each duration supplies a small number of independent find rolls. On every roll,
each eligible location resource receives one find attempt.

```text
find bonus % = clamp((Gathering level - 1) × 0.5 + Luck × 0.4
                     + Gathering Efficiency, -50, 150)

effective chance = clamp(admin base chance × (1 + find bonus / 100),
                         0.001, 0.95)

quantity bonus % = clamp((Gathering level - 1) × 0.2
                          + positive Luck × 0.1
                          + Gathering Efficiency × 0.5, 0, 100)

reward quantity = round(random(admin minimum, admin maximum)
                        × duration quantity multiplier
                        × (1 + quantity bonus / 100))
```

Values are intentionally bounded. This keeps level and bonuses useful without
making a configured rare find certain. If every attempt misses, one resource is
selected using the configured base chances as relative weights; expeditions
therefore always return with at least one valid find.

Luck and Gathering Efficiency aggregate character base stats, equipped-item
stats, and the active timed consumable effect. Configured food, potion, and
elixir items all use that same effect slot (drink-style provisions can use FOOD
or ELIXIR), so they fit the same departure snapshot rather than requiring a
second reward formula.

## Player information

`/skills/Gathering` shows only the character's current location, duration
choices, relevant active bonuses, journey progress, claim state, and the
returned haul. Its field guide lists that location's resources in configured
rarity order. Resources above the player's Gathering level are anonymous
discovery slots: only their required level is returned by the API, so names,
icons, and rarities cannot be recovered from the player page. Find chances,
roll counts, and quantity bounds are never exposed.

## Admin workflow

`/admin/gathering` provides three focused editors plus a balance simulator:

1. Resource rarity and required Gathering level.
2. Existing-location availability, location level gate, pool membership, base
   find chance, and quantity range.
3. Duration, required Gathering level, find rolls, quantity scaling, XP,
   enabled state, and display order.

The simulator runs the production reward calculator repeatedly without creating
an expedition or changing player data. An administrator can load any configured
location and duration, enter aggregate Gathering level, Luck, and Gathering
Efficiency, override the scenario's rolls, time, quantity scaling, and resource
pool, then compare observed find rates and quantities per expedition and hour.
Scenario pool overrides are temporary and do not save over location balance.

Use `/admin/gardening` for seeds and crop timing. Use the regular item and
vocation-resource editors when changing the underlying item template or creating
a new Gathering resource.

## Initial content and setup

The initial pack contains Mushrooms, Blackberries, Cranberries, Chestnuts, Wild
Plums, Wild Apples, Mint, Chamomile, Thyme, Sage, Rosemary, and Lavender across
four existing atlas locations. It provides one-, two-, three-, and four-hour
durations, unlocked at Gathering levels 0, 15, 50, and 100 respectively. Every
duration gate can be adjusted from `/admin/gathering`.

After deploying the migration, apply and verify the idempotent content pack:

```bash
npm run db:migrate
npm run db:seed:gathering -- --check
npm run db:seed:gathering -- --apply
npm run db:seed:gathering -- --verify
npm test
```

Definitions live in `prisma/content/gathering.ts`. Runtime sprites live below
`public/assets/items/resources`; source masters and generation notes live in
`art/items/gathering-v1`.

### Recovery for the original query-30 failure

If `20260915190000_gardening_and_gathering_expeditions` previously stopped with
MariaDB error 1052 (`Column 'level' in UPDATE is ambiguous`), the schema portion
has already been committed. Do not immediately rerun the full migration. Apply
the checked-in, idempotent data-only remainder and then tell Prisma the manually
completed migration is applied:

```bash
npx prisma db execute --file scripts/repairGatheringMigration.sql
npx prisma migrate resolve --applied 20260915190000_gardening_and_gathering_expeditions
npx prisma migrate status
npm run db:migrate
```

After that succeeds, run the Gathering content-pack check/apply/verify commands
from the preceding section.
