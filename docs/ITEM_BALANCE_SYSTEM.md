# Live Item Balance

Item balance is shared definition data. It is not copied into every player-owned
item. A `UserItem` stores ownership, rarity, enchant level, quantity, state and
additive instance modifiers; inventory, equipment and marketplace reads resolve its
effective stats from the current `Item` definition.

## Resolution order

Rarity is a label only (how rare an item is). It never changes stats; since
2026-11-13 the enchant level does. For each stat, at the copy's enchant level:

1. Start with `ItemStat.value`.
2. Add every `ItemStatEnchantUnlock` whose level the copy has reached.
3. Multiply positive values by the level's global stat bonus from
   `/admin/enchanting` (`EnchantLevelConfig.statBonusPercent`), unless this
   item/stat/level has a `MULTIPLIER` override in `ItemStatEnchantOverride`.
   A weapon's own Attack Speed and negative stats never take the global bonus.
4. A per-item `ABSOLUTE` override can instead set the final value.
5. Apply the stat cap, if configured.
6. Add `UserItemStatModifier` values belonging to this particular instance.

One function does steps 1-5 (`enchantStat` in `src/utils/itemInstanceStats.ts`),
and the "Enchant scaling" grid on `/admin/items/[id]` calls the same function,
so the grid shows exactly what players get.

Example: a sword has base damage 100 and +15 is +22.5% globally. Its own +15
override is a 1.30 multiplier. Every +14 copy resolves to 121 (at +21%) and
every +15 copy to 130, wherever it is.

The old rarity multipliers were baked into each item's base stats at its own
rarity (`scripts/bakeRarityIntoStats.ts`, backup in
`prisma/rebalance/backup-before-enchant-scaling.json`). Seed content is still
authored as Common values and baked the same way on seed
(`prisma/content/legacyRarity.ts`).

## Scale

A balance publish changes only the shared item definition. It never scans or
updates player inventories, so the write cost is independent of player count.
Reads resolve only the small page/equipment set currently requested.

`UserItemStatModifier` maps to the existing `UserItemStat` table, but its rows
now mean additive instance-only effects. The live-balance migration clears old
materialized template snapshots before this new meaning takes effect. Future
enchantments should write only their instance delta here, never a copy of the
item's base or enchant-derived stats.

## Publishing rules

- Admin item edits publish the item row and all related balance rows in one
  database transaction.
- Marketplace asking prices and historical transaction prices are contracts;
  balance edits do not rewrite them.
- In-progress timed activities may keep their start-time snapshot. Subsequent
  actions resolve the current item balance.
- Structural changes such as stackability, maximum stack size or equipment slot
  still require a dedicated data migration because they can invalidate stored
  inventory/equipment state.
