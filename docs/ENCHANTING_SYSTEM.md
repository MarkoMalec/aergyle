# Enchanting System

Status: built on branch `feature/enchanting` (2026-11-12). Items marked
**OPEN** are still undecided; the value next to them is the code default.
Code defaults live in `src/game/enchanting.ts` and apply until
`/admin/enchanting` saves a row.

## Goal

A deep, expensive progression layer on top of an item's fixed rarity. It is
the main gold and material sink: idle players pile up materials, enchanting
burns them, and failures make it a gamble you can't spam cheaply.

## Rarity vs. enchant level

- **Rarity** is what an item drops or is crafted at. It never changes and is
  a label only: it says how rare an item is and has no effect on its stats.
  (Rarity multipliers were removed on 2026-11-13; see
  docs/ITEM_BALANCE_SYSTEM.md.)
- **Enchant level** is per item instance and starts at nothing. It is the
  only thing enchanting changes.
- The rarity table's Upgrade, Next and Cost columns (and the unused Min, Max
  and Bonus%) are removed; enchant costs live in the enchant table.

## The ladder

| Kind | Levels |
|---|---|
| Weapons, armor (incl. offhand and belt) and tools (felling axe, pickaxe, fishing rod, hoe) | +1 … +15, then I · Kindled, II · Forged, III · Hallowed, IV · Exalted, V · Ascendant |
| Accessories (ring, necklace, amulet) | I · Kindled … V · Ascendant only; the first success goes straight to I |

- An item at nothing shows no prefix. `+7 Iron Greataxe`, `Hallowed (III) Silver Ring`.
- Not enchantable: `backpack` and anything stackable. Tool efficiency scales
  with the enchant bonus like any other stat.

## An attempt

### Weapons and armor

Costs gold + materials. On failure:

- +1 … +15 and the attempt at Kindled: the materials and gold are lost, the
  item stays.
- From Kindled up (attempts at Forged … Ascendant): the item also drops one
  level. Per level in admin (`dropOnFail`).

### Accessories

Costs gold + materials + **a copy of the same item at the same enchant
level** (same rarity is automatic, rarity is fixed per item). On failure both
the accessory and the copy are destroyed.

- Reaching V needs 2⁵ = 32 base copies even with no failures (accepted).
- Later: a protection item that saves the accessory on failure.

### Rules

- Gear: from the inventory or equipped. Accessories: from the inventory only.
  Never while listed or in storage.
- Not while the player is in an activity (`assertNoOtherActivity`).
- Enchanted items never stack (gear is already non-stackable).
- Server-side roll, under the user lock, in one transaction.

## Success chance

- Per enchant level in the enchant table.
- **Per-item override:** an optional chance for one item at one enchant
  level, which replaces the table value.
- Later: luck items add to it.

### Fail stack (per player, any item)

Every failed attempt on any item adds one to the player's fail stack
(`User.enchantFailStack`); any success resets it to 0. Each stack adds a
capped bonus, so a player can fail cheap attempts on purpose to build a
stack for an important one (intended). It nudges the chance, never decides
it.

- Default: +0.25 percentage points per stack, capped at +10 points.
- Shown on the bench as "Fail stack +N", never as a percentage.
- Both values tunable in admin.

## Cost

- **Gold** = level cost (enchant table) × item-level factor × modifiers.
  - Item-level factor keeps costs meaningful in an endless game. Default
    `1 + requiredLevel / 50`, tunable.
  - Modifiers multiply on top: later repeated-attempt surcharges and cost
    reducers.
- **Materials** per enchant level: a list of item + quantity in the enchant
  table. **OPEN** Which materials. Direction agreed so far:
  - no plain ingots; multi-profession reagents (alchemy from gathering,
    hunting and fishing outputs);
  - the top tiers need a rare dungeon drop;
  - one NPC-only ingredient, because gold paid to an NPC is the only part
    that actually leaves the economy (player-to-player sales just move it).

## Power

- Each enchant level adds a percentage to all of the item's stats except
  Attack Speed, tunable per level. Per item, any stat at any level can get its
  own multiplier or an exact value, and stats can unlock from a level up (the
  "Enchant scaling" grid and "Unlocks by enchant level" on `/admin/items/[id]`).
- Default: +1.5% per level up to +15 (+22.5%), then +6% per named tier
  (+52.5% at V). Accessories: +10% per tier. Stored as the total per level.
- Penalties (negative stats) and Attack Speed are not raised.
- Percentage stats keep their per-item `maxValue` caps.

## Marketplace

- The item list stays one row per item (`Iron Shield`).
- Opening it shows the enchant levels on offer; opening a level shows the
  listings for that item at that level.
- Buy orders, price history and grouping key on item + rarity + enchant level.

## Data

- `UserItem.enchantLevel Int @default(0)` (0–20; 16–20 are the named tiers).
- `EnchantLevelConfig`: one row per level and kind (gear / accessory) with
  success chance, gold cost, stat bonus %, drop-on-failure and break flags.
- `EnchantLevelMaterial`: level + kind → item + quantity.
- `ItemEnchantChanceOverride`: item + level → success chance.
- `User.enchantFailStack`: consecutive failed enchants, any item.
- Stats: `resolveEffectiveItemStats` (`src/utils/itemInstanceStats.ts`) gets
  the enchant bonus; everything that reads item stats goes through it.
- Admin: an enchant table page, plus the per-item overrides in the item
  editor.

## Player UI

- Opened with the **Enchant** button above the bag on `/inventory`; item
  popovers have no enchant action.
- A bench along the bottom of the screen (`EnchantPanel.tsx`), drawn as inline
  SVG after the reference screenshots: cost slots on the left → chance
  diamond → the item inside three rings, with the level at stake in the small
  diamond. Slots hold the same item tiles as the bag.
- The inventory (worn gear, then the bag) sits above the bench. The player
  drags or taps the item onto the right slot, then drags or taps each
  material (and an accessory's spare copy) onto its slot on the left; nothing
  is filled in automatically. Whatever can't be used for the current step is
  greyed out. Tapping a slot, or dragging its item back to the inventory,
  empties it. Materials stay in place between attempts while the stack lasts.
- Placing a material chooses its type, not the stack: the server still takes
  the quantity from the player's stacks of that item. The spare copy is the
  exact one placed.
- Gold is not a slot; it is the "Cost per attempt" line under the bench.
- An attempt fills every line left to right as one steady flow led by a
  bright head, holds for a beat, then shows the result. Long shots charge
  longer (`enchantChargeMs`). The bag and preview refresh only at the reveal.
- Success: a flash, sparks, and the homepage rarity showcase's rays turning
  slowly behind the item in its rarity colour until the next attempt. Failure:
  the lines turn red and run back out; a broken accessory shatters.
- "Skip animation" (remembered per browser) skips only the fill; the result
  effects still play. Reduced-motion settings show the result with no effects.
- The PNG frames in `public/assets/ui/enchanting/` are not used.

## Not in the first build

Luck items, protection items, repeated-attempt surcharges, cost reducers,
enchant journal/history.
