# Dungeons

Dungeons are timed, lethal PvE runs inside a world location. A player picks a
dungeon at their current location, enters with their current health and combat
stats, and the server resolves the whole run once the timer ends. There is no
real-time combat.

## Flow

1. The dungeon page shows each dungeon's difficulty label, duration, XP,
   inhabitants, whether enemies come one at a time or in groups, and a
   **recommended health** calculated for the player's gear. Monster counts are
   never sent to the client.
2. Entering requires the dungeon's character level, the location's level, and
   at least the configured share of maximum health. Entry snapshots the
   character's combat stats, current health, the monster population with drop
   tables, the death rules and a random seed.
3. Leaving before the timer ends deletes the run: no loot and no health loss.
4. After the timer ends, claiming resolves the run from the snapshot:
   - **Cleared:** the character keeps all monster loot and gains the dungeon's
     XP (`XpActionType.DUNGEON`). The damage taken is deducted from current
     health, which never drops below 1.
   - **Defeated:** health becomes 0 and no XP is awarded. The loot gathered
     before the fall goes through the death penalty. The journal reads "You
     managed to crawl out with …".
5. Every PvE activity has a minimum health to start, so a defeated character
   must regenerate before fighting again.

A run counts as an active activity. Travel, vocations, gardening, gathering,
hunting and equipment changes are blocked until it is claimed or left.

## Data model

- `Creature` (shared with Hunting) holds an attack profile (attack style,
  physical damage, magic damage, an optional `damageType` with elemental
  damage, critical chance and damage) and a defensive profile (health, armor,
  magic resist, evasion, block). All default to 0. Dungeons use `MONSTER`
  creatures only. Hunting retaliation uses the same attack profile, but not the
  defensive one (see [Hunting](HUNTING_SYSTEM.md#animal-defensive-stats)).
- `CreatureDrop` is the loot table. Any item can be a drop, for animals and
  monsters alike. For monsters, `requiredLevel` is the character level.
- `Dungeon` belongs to a `Location`. It has a difficulty label, level, duration,
  pack size, XP, enabled flag and sort order, and **no loot of its own**.
- `DungeonMonster` places a monster in a dungeon with a hidden `minCount`–
  `maxCount` range.
- `DungeonConfig` (singleton) holds the entry threshold and death penalty.
- `UserDungeonRun` is one row per character, kept after claim so the journal
  survives refresh.

## Combat resolution

`src/server/dungeons/resolver.ts` is pure and deterministic for a given seed,
so a claim retried after a full inventory resolves identically.

- Each monster's count is rolled in its range, and the resulting lineup is
  shuffled.
- Up to `packSize` monsters are **engaged** at once (1 = one at a time). Gaps
  are refilled from the lineup at the start of each round.
- Each round, the character strikes `attackSpeed` times (fractional speeds
  accumulate) at the first engaged monster; leftover strikes move on to the
  next engaged monster. Clearing the whole pack ends the round.
- **Blows are simultaneous:** every monster engaged at the start of the round
  strikes back that round, even one the character kills in it. So each
  monster always lands at least one attack, and the number of monsters matters
  for every character, however hard they hit. With bigger packs, monsters
  waiting to be killed keep attacking, so danger grows quickly for characters
  who kill slowly.
- Monsters killed in a round drop loot only if the character survives that
  round. If both fall in the same round, the run is a defeat.
- **Character strike:** monster evasion can avoid it. Otherwise it deals
  physical damage × `100 / (100 + monster armor)` plus magic damage ×
  `100 / (100 + monster magic resist)`. A critical hit multiplies it by
  `criticalDamage / 100`, and a monster block halves it.
- **Monster strike** (`resolveCreatureStrike` in `src/server/combat/rules.ts`,
  shared with Hunting retaliation): the evasion matching its attack style can
  avoid it. Otherwise it deals physical damage × `100 / (100 + armor)` plus
  magic damage × `100 / (100 + magic resist)`. If it has a damage type, it adds
  elemental damage × `(1 − resistance / 100)` using Fire, Cold (for Ice),
  Lightning or Poison resistance. Critical hits use `critDamage / 100` (at
  least ×1). The character's block halves the strike.
- Evasion and block are capped at 75%.
- Every defeated monster rolls each drop independently. Luck raises drop
  chances through the shared expedition formula; chances are capped at 95%.
- A run that exceeds 10,000 combat rounds counts as a defeat. This only
  happens when the character cannot meaningfully damage a monster.

## Recommended health and the death penalty

Recommended health comes from `estimateRecommendedHealth`. It resolves the
dungeon 200 times with unlimited health, using the player's current stats and
a fixed seed, and returns the health needed to survive 90% of those runs. If
the character is overwhelmed in more than 10% of the runs, the page shows the
dungeon as beyond their gear.

On defeat, each looted stack is kept with `deathLootKeepChance`, and a kept
stack is reduced to `deathLootQuantityPercent` of its quantity (at least 1).
The defaults are 35% and 25%.

## Bestiary

`/animals` and `/monsters` are grids of enabled creatures (portrait and
name). Each creature has a profile page (`/animals/[id]`, `/monsters/[id]`)
with its portrait, attack and defence stats, description, where it is found,
and possible loot. Drop chances and quantities are never shown; the Hunting
API still returns chances for possible future use. The Hunting and dungeon
screens link to these profiles instead of showing loot inline.

## Administration

- `/admin/dungeons` has:
  - **Rules for every dungeon:** entry health threshold and the death penalty,
    shown as percentages.
  - **Test character:** the character every balance preview simulates. It
    starts as a level 1 character without gear, using the base stats from
    `/admin/character-stats`, and can be edited. Reset rebuilds a character
    without gear at the entered level.
  - **Dungeons:** each dungeon opens into three explained steps (Basics, Entry
    and reward, Monsters with pack size and population) next to a **balance
    preview**. The preview runs 1,000 simulations of the unsaved values
    through the production resolver and shows survival chance, recommended
    health, monsters per run, average damage and average loot. Unsaved
    changes are marked and can be reverted.
  - **Monster catalogue:** stats and drop tables.
- `/admin/hunting` uses the same creature editor for animals. The creature API
  lives at `/api/admin/creatures`.
- Deleting a creature removes its drops and placements; runs already in
  progress keep their snapshot. A dungeon cannot be deleted while a character
  is inside it; disable it first.

## Operations

1. Deploy `prisma/migrations/20260917180000_dungeons/`,
   `prisma/migrations/20260918090000_creature_magic_damage/` and
   `prisma/migrations/20260918120000_dungeon_pack_size/`.
2. Preview the starter content with `npm run db:seed:dungeons -- --check`.
3. Apply it with `npm run db:seed:dungeons -- --apply`.
4. Verify it with `npm run db:seed:dungeons -- --verify`.
5. Run the rules tests with `npm run test:dungeons`.

The starter content adds the Goblin (drops Cloth Scraps, Small Bones, Dusk Oil
and, rarely, a Wooden Dagger) and Gloamvault, an Easy 15-minute dungeon in
Crownhold holding 2–4 goblins. The seeder expects those items to exist already.
