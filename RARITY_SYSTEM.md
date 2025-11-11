# Item Rarity System Documentation

## Overview

A flexible rarity system that applies stat multipliers to items. Higher rarities provide better stats, and items can be upgraded through rarities.

## Rarity Tiers

| Rarity | Multiplier | Color | Min Stats | Max Stats | Bonus Chance | Upgrade Cost |
|--------|-----------|-------|-----------|-----------|--------------|--------------|
| **Worthless** | 0.5x (50%) | Dark Gray | 1 | 1 | 0% | 50 |
| **Broken** | 0.75x (75%) | Brown | 1 | 2 | 0% | 75 |
| **Common** | 1.0x (100%) | Gray | 1 | 2 | 0% | 100 |
| **Uncommon** | 1.15x (115%) | Green | 2 | 3 | 10% | 500 |
| **Rare** | 1.35x (135%) | Blue | 2 | 4 | 25% | 2,000 |
| **Exquisite** | 1.5x (150%) | Cyan | 3 | 4 | 35% | 5,000 |
| **Epic** | 1.7x (170%) | Purple | 3 | 5 | 50% | 10,000 |
| **Elite** | 1.9x (190%) | Pink | 3 | 6 | 65% | 25,000 |
| **Unique** | 2.1x (210%) | Amber | 4 | 7 | 75% | 50,000 |
| **Legendary** | 2.3x (230%) | Gold | 4 | 8 | 85% | 100,000 |
| **Mythic** | 2.7x (270%) | Red | 5 | 9 | 95% | 250,000 |
| **Divine** | 3.0x (300%) | White | 6 | 10 | 100% | N/A | 

## How It Works

### 1. Base Stats
Every item has **base stats** defined in the ItemStat table. These are the foundation values at Common rarity (1.0x multiplier).

Example - Iron Sword (Common):
```
Physical Damage: 10-20
Attack Speed: 1.2
```

### 2. Rarity Multiplier
When an item's rarity changes, **all stats are multiplied** by the rarity multiplier.

Example - Iron Sword (Legendary, 2.0x):
```
Physical Damage: 20-40  (10-20 × 2.0)
Attack Speed: 2.4       (1.2 × 2.0)
```

### 3. Stat Calculation Flow

```
Base Item Stats → × Rarity Multiplier → Final Item Stats
```

The system stores the **multiplied values** in ItemStat table, so queries are fast.

## Usage Examples

### Initialize Rarity Configs (Run Once)

```typescript
import { initializeRarityConfigs } from "~/utils/rarity";

// Populates RarityConfig table with default values
await initializeRarityConfigs();
```

Or via API:
```bash
POST /api/admin/rarity/init
```

### Apply Rarity to New Item

```typescript
import { applyRarityToItemStats } from "~/utils/rarity";
import { ItemRarity, StatType } from "@prisma/client";

const baseStats = [
  { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 10 },
  { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 20 },
  { statType: StatType.ATTACK_SPEED, value: 1.2 },
];

// Apply Epic rarity (1.6x multiplier)
await applyRarityToItemStats(itemId, baseStats, ItemRarity.EPIC);

// Result in database:
// PHYSICAL_DAMAGE_MIN: 16  (10 × 1.6)
// PHYSICAL_DAMAGE_MAX: 32  (20 × 1.6)
// ATTACK_SPEED: 1.92       (1.2 × 1.6)
```

### Upgrade Item Rarity

```typescript
import { upgradeItemRarity } from "~/utils/rarity";

const result = await upgradeItemRarity(itemId, userId);

if (result.success) {
  console.log(`Upgraded to ${result.newRarity}`);
  console.log(`New stats:`, result.newStats);
}
```

Or via API:
```bash
POST /api/items/upgrade-rarity
{
  "itemId": 123,
  "userId": "user_abc"
}
```

### Calculate Preview Stats (No DB Change)

```typescript
import { calculateRarityStats } from "~/utils/rarity";

const baseStats = [
  { statType: StatType.ARMOR, value: 50 },
];

// Preview what stats would be at Legendary
const legendaryStats = calculateRarityStats(baseStats, ItemRarity.LEGENDARY);
// Result: [{ statType: ARMOR, value: 100 }]
```

### Get Rarity Info for UI

```typescript
import { getRarityColor, getRarityMultiplier } from "~/utils/rarity";

const color = getRarityColor(item.rarity);
// Returns: "#eab308" for Legendary

const multiplier = getRarityMultiplier(item.rarity);
// Returns: 2.0 for Legendary
```

## Upgrade System

### Cost Per Tier
```
Common → Uncommon: 100 gold
Uncommon → Rare: 500 gold
Rare → Epic: 2,000 gold
Epic → Unique: 10,000 gold
Unique → Legendary: 50,000 gold
Legendary → Mythic: 250,000 gold
```

### Upgrade Flow
1. Check item's current rarity
2. Look up RarityConfig for next tier
3. Verify upgrade is possible (not already Mythic)
4. Calculate base stats (divide by current multiplier)
5. Apply new rarity multiplier
6. Update ItemStat table with new values

### Example Progression
```
Iron Sword Base Stats: 10-20 damage

Common (1.0x):     10-20 damage
Uncommon (1.15x):  11.5-23 damage
Rare (1.35x):      13.5-27 damage
Epic (1.6x):       16-32 damage
Unique (1.85x):    18.5-37 damage
Legendary (2.0x):  20-40 damage
Mythic (2.5x):     25-50 damage
```

## Database Schema

### RarityConfig Table
```prisma
model RarityConfig {
  id                Int
  rarity            ItemRarity  @unique
  statMultiplier    Float       // 1.0, 1.15, 1.35, etc.
  minStats          Int         // Minimum number of stats
  maxStats          Int         // Maximum number of stats
  bonusStatChance   Float       // Chance for extra stat
  color             String      // Hex color for UI
  displayName       String      // "Common", "Legendary", etc.
  sortOrder         Int         // For ordering in UI
  upgradeEnabled    Boolean     // Can upgrade from this tier?
  nextRarity        ItemRarity? // Next tier in progression
  upgradeCost       Int?        // Cost to upgrade
}
```

## Future Enhancements

### 1. Enchanting System
```typescript
// Add extra stats to item when enchanting
await addEnchantment(itemId, StatType.CRITICAL_CHANCE, 5);
// Rarity multiplier applies to enchantments too!
```

### 2. Reforging
```typescript
// Keep rarity, reroll base stats
await reforgeItem(itemId);
```

### 3. Set Bonuses
```typescript
// Legendary+ items can have set bonuses
if (item.rarity >= ItemRarity.LEGENDARY) {
  // Apply set bonus if wearing 2+ items from same set
}
```

### 4. Rarity-Specific Effects
```typescript
// Unique+ items can have special procs/effects
const config = await getRarityConfig(item.rarity);
if (config.sortOrder >= 5) { // Unique or higher
  // Add special effect
}
```

## UI Integration

### Display Item with Rarity Color
```tsx
import { getRarityColor } from "~/utils/rarity";

<h3 style={{ color: getRarityColor(item.rarity) }}>
  {item.name}
</h3>
<p style={{ color: getRarityColor(item.rarity) }}>
  {item.rarity}
</p>
```

### Show Upgrade Preview
```tsx
const currentMultiplier = getRarityMultiplier(item.rarity);
const nextRarity = rarityConfig.nextRarity;
const nextMultiplier = getRarityMultiplier(nextRarity);

const upgrade = ((nextMultiplier / currentMultiplier - 1) * 100).toFixed(0);
// Shows: "+25% stats" for Rare → Epic
```

## Best Practices

1. **Always initialize configs first**: Run `initializeRarityConfigs()` once when setting up the game
2. **Store base stats**: Keep base (Common) stats somewhere for reference if you need to recalculate
3. **Use preview calculations**: Show players stat changes before committing upgrades
4. **Cache rarity colors**: The color mapping is static, cache it client-side
5. **Batch operations**: When generating lots of items, batch the stat applications

## Performance Considerations

- **Denormalized stats**: ItemStat table stores final multiplied values for fast queries
- **Indexed lookups**: RarityConfig uses unique index on rarity field
- **Client-side caching**: Rarity colors and multipliers can be cached
- **Marketplace sorting**: Indexed columns on Item table for quick rarity filtering
