# Live Item Balance

Item balance is shared definition data. It is not copied into every player-owned
item. A `UserItem` stores ownership, rarity, quantity, state and additive
instance modifiers; inventory, equipment and marketplace reads resolve its
effective stats from the current `Item` definition.

## Resolution order

For each stat:

1. Start with `ItemStat.value`.
2. Add unlocked `ItemStatProgression.baseValue` entries.
3. Use the global `RarityConfig.statMultiplier`, unless this item/stat/rarity
   has a `MULTIPLIER` override. A weapon's own Attack Speed never takes the
   global multiplier.
4. A per-item `ABSOLUTE` override can instead set the final template value.
5. Apply the stat cap, if configured.
6. Add `UserItemStatModifier` values belonging to this particular instance.

Example: a sword has base damage 100. Its UNIQUE rule is 1.00 and its
LEGENDARY rule is 1.15. Every UNIQUE copy resolves to 100 and every LEGENDARY
copy resolves to 115, regardless of whether it is equipped, in inventory or on
the marketplace.

## Scale

A balance publish changes only the shared item definition. It never scans or
updates player inventories, so the write cost is independent of player count.
Reads resolve only the small page/equipment set currently requested.

`UserItemStatModifier` maps to the existing `UserItemStat` table, but its rows
now mean additive instance-only effects. The live-balance migration clears old
materialized template snapshots before this new meaning takes effect. Future
enchantments should write only their instance delta here, never a copy of the
item's base or rarity-derived stats.

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
