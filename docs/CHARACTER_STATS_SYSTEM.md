# Character stats

Gameplay uses `getCharacterStatSnapshot(userId)` from `src/server/stats.ts` as
the server-authoritative view of a character. It combines each source once:

1. character base stats: the level-scaled value (see below) plus the
   character's own `CharacterBaseStat` additions;
2. stats on owned, usable `UserItem` instances referenced by `Equipment`;
3. the active timed food, potion or elixir effect.

`Equipment.*ItemId` fields are the source of truth for equipped slots. The
older `UserItem.status = EQUIPPED` value is accepted for compatibility, but it
does not decide whether an item is equipped. Listed, sold and deleted items do
not contribute even if a stale equipment reference exists.

## Base stats by level

Every character's base stats grow with their main level. Each stat has one
rule, edited at `/admin/character-stats`:

```
base stat = level 1 value + min(bonus cap, per level × (level − 1))
```

An empty cap means the bonus never stops growing. Rules live in
`CharacterStatGrowth`; a stat without a row uses the defaults in
`getDefaultStatGrowthRules()` (`src/utils/stats.ts`), whose level 1 values are
`getDefaultBaseStats()`.

Base stats are never stored per character. `getCharacterBaseStats` works them
out from the current level and rules on every read, so a level-up or an admin
edit applies at once to every existing character, like live item balance.
Activities that snapshot stats when they start keep their snapshot.
`CharacterBaseStat` rows only add per-character bonuses on top (none are
written yet).

The defaults are balanced like this:

- Growth is a flat amount per level, so each level is a smaller share of the
  total as a character levels. With the defaults, level 50 has 3–4% more
  base health, damage and armor than level 48, and more than twice the base
  values of level 1.
- Health regeneration grows at the same rate as health, so a full heal takes
  equally long at every level.
- Chance-based stats (critical chance, evasion, resistances), critical damage,
  attack speed and accuracy have a cap, so gear stays their main source.
- Luck, gold find, experience gain, block, lifesteal, thorns, movement speed
  and vocation efficiencies do not grow by default. Vocations have their own
  levels, and economy stats would compound with the better content that
  higher levels already unlock.
- Carrying capacity cannot scale with level. It is stored in
  `Inventory.maxSlots` and recalculated only when equipment changes.

The admin page previews two levels side by side (48 and 50 by default) with
unsaved values, so the size of each step can be checked before saving. The
dungeon admin's test character starts from the same rules, and its reset
button builds a character of the entered level without gear.

## Attack speed

A weapon's Attack Speed is how fast that weapon strikes. It replaces the
unarmed speed (the level 1 Attack Speed value, 1.0 by default) instead of
adding to it, so a 0.55 mace makes a character slower than fighting unarmed.
Level growth, Attack Speed on other gear and food still add on top. A weapon
without its own Attack Speed keeps the unarmed speed. The main hand sets the
pace: a one-handed weapon in the off hand adds its damage and other stats but
not its own Attack Speed. A shield's Attack Speed is a bonus like other gear.

Rarity scales a weapon's damage but not its Attack Speed. A per-item rarity
override still applies when an admin sets one. Attack Speed on other gear is a
bonus and scales with rarity like any stat. The rules are
`weaponAttackSpeedAdjustment` (`src/utils/stats.ts`) and `statScalesWithRarity`
(`src/utils/itemInstanceStats.ts`).

## Current consumers

- Gathering snapshots Luck and Gathering Efficiency at departure.
- Woodcutting, Mining and Fishing derive their action time from the matching
  efficiency stat across the entire character, not only the tool itself.
- Inventory capacity uses the same Carrying Capacity total.
- The character sheet uses the same pure aggregation and cap functions for
  immediate feedback after an equipment change.

Long-running activities snapshot relevant values when they start so later
equipment or effect changes cannot alter an activity already in progress.

## Adding a stat consumer

Server gameplay must read the canonical snapshot rather than querying
`UserItemStat` or reconstructing equipment locally. A feature then applies its
own documented gameplay rule to `snapshot.totals[StatType.*]` or to a capped
value in `snapshot.finalStats`.

Adding a vocation efficiency stat also requires one entry in
`src/game/vocationStats.ts`. That mapping is shared by item-instance creation,
the admin item editor and vocation runtime calculations, preventing creation
and consumption from drifting apart.
