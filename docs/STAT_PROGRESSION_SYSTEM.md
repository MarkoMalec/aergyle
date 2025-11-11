# Stat Progression System - Implementation Summary

## What Changed

### ✅ Migration Complete
- Added `ItemStatProgression` table to database
- Migration `add_item_stat_progression` successfully applied

### ✅ Updated Functions
1. **`createUserItem()`** (`src/utils/userItems.ts`)
   - Now checks for `ItemStatProgression` entries
   - Only applies stats that unlock at or before the chosen rarity
   - Falls back to old `ItemStat` system if no progressions exist

2. **`upgradeUserItemRarity()`** (`src/utils/userItems.ts`)
   - Recalculates stats based on progressions when upgrading
   - New stats unlock when reaching their unlock rarity
   - Example: MYTHIC upgrade adds attack speed if defined in progressions

### ✅ New Utility Functions
Created `src/utils/statProgressions.ts` with:
- `setItemStatProgressions()` - Define all progressions for an item
- `addStatProgression()` - Add single progression
- `getItemStatProgressions()` - View current progressions
- `getStatsForRarity()` - Calculate what stats exist at specific rarity
- `importStatProgressions()` / `exportStatProgressions()` - CSV support

### ✅ Example Script
Created `scripts/setupStatProgressions.ts` showing how to configure progressions for weapons and armor.

---

## How It Works

### Database Schema

```prisma
model ItemStatProgression {
  id              Int        @id @default(autoincrement())
  itemId          Int        // Which item template
  statType        StatType   // Which stat (CRITICAL_CHANCE, etc.)
  baseValue       Float      // Base value before rarity multiplier
  unlocksAtRarity ItemRarity // When this stat becomes available
  
  item Item @relation(fields: [itemId], references: [id])
  
  @@unique([itemId, statType, unlocksAtRarity])
}
```

### Example Progression

**Wooden Sword (itemId: 19):**
```typescript
ItemStatProgression:
1. CRITICAL_CHANCE, baseValue: 5, unlocks: COMMON
2. ATTACK_SPEED, baseValue: 0.1, unlocks: MYTHIC  
3. LIFESTEAL, baseValue: 3, unlocks: DIVINE
```

**What Players Get:**

| Rarity | Stats |
|--------|-------|
| COMMON (1.0x) | CRITICAL_CHANCE: 5 |
| RARE (1.35x) | CRITICAL_CHANCE: 6.75 |
| MYTHIC (2.7x) | CRITICAL_CHANCE: 13.5, **ATTACK_SPEED: 0.27** ⭐ |
| DIVINE (3.0x) | CRITICAL_CHANCE: 15, ATTACK_SPEED: 0.3, **LIFESTEAL: 9** ⭐ |

**Key Point:** All MYTHIC Wooden Swords have identical stats. No RNG.

---

## How to Use

### 1. Configure Progressions for an Item

```typescript
import { setItemStatProgressions } from "~/utils/statProgressions";
import { StatType, ItemRarity } from "@prisma/client";

await setItemStatProgressions(19, [ // Wooden Sword
  { 
    statType: StatType.CRITICAL_CHANCE, 
    baseValue: 5, 
    unlocksAtRarity: ItemRarity.COMMON 
  },
  { 
    statType: StatType.ATTACK_SPEED, 
    baseValue: 0.1, 
    unlocksAtRarity: ItemRarity.MYTHIC 
  },
]);
```

### 2. Create UserItem (Automatic)

```typescript
import { createUserItem } from "~/utils/userItems";

// Player gets a RARE Wooden Sword
const userItemId = await createUserItem(
  userId,
  19, // Wooden Sword template
  ItemRarity.RARE
);

// Automatically has: CRITICAL_CHANCE: 6.75
// Does NOT have: ATTACK_SPEED (unlocks at MYTHIC)
```

### 3. Upgrade Item (Automatic)

```typescript
import { upgradeUserItemRarity } from "~/utils/userItems";

// Upgrade RARE → EXQUISITE → EPIC → ... → MYTHIC
const result = await upgradeUserItemRarity(userItemId, userId);

// When it reaches MYTHIC:
// - CRITICAL_CHANCE gets recalculated: 5 × 2.7 = 13.5
// - ATTACK_SPEED unlocks: 0.1 × 2.7 = 0.27 ⭐ NEW STAT!
```

---

## Migration Path

### For New Items
Just define progressions before creating any UserItems.

### For Existing Items

**Option A: Leave as-is**
- Items without progressions use old `ItemStat` system
- System is backward compatible
- Works fine, just no stat unlocking on upgrade

**Option B: Add progressions later**
- Define progressions for existing templates
- Old UserItems keep their stats
- NEW UserItems use progressions
- Optional: Run migration script to update existing UserItems

**Option C: Full migration**
```typescript
// Delete all UserItems for an item (nuclear option)
await prisma.userItem.deleteMany({
  where: { itemId: 19 }
});

// Set up progressions
await setItemStatProgressions(19, [...]);

// Players will get new items with progressions when dropped
```

---

## Configuration Examples

### Weapon (Progressive Damage)
```typescript
await setItemStatProgressions(23, [ // Silver Revolver
  { statType: StatType.PHYSICAL_DAMAGE_MIN, baseValue: 15, unlocksAtRarity: ItemRarity.COMMON },
  { statType: StatType.PHYSICAL_DAMAGE_MAX, baseValue: 25, unlocksAtRarity: ItemRarity.COMMON },
  { statType: StatType.CRITICAL_DAMAGE, baseValue: 25, unlocksAtRarity: ItemRarity.EPIC },
  { statType: StatType.ACCURACY, baseValue: 10, unlocksAtRarity: ItemRarity.MYTHIC },
]);
```

### Armor (Progressive Defense)
```typescript
await setItemStatProgressions(25, [ // Gold Helmet
  { statType: StatType.ARMOR, baseValue: 15, unlocksAtRarity: ItemRarity.COMMON },
  { statType: StatType.HEALTH, baseValue: 50, unlocksAtRarity: ItemRarity.RARE },
  { statType: StatType.HEALTH_REGEN, baseValue: 2, unlocksAtRarity: ItemRarity.LEGENDARY },
]);
```

### Accessory (Utility Focus)
```typescript
await setItemStatProgressions(34, [ // Gold Amulet
  { statType: StatType.MANA, baseValue: 30, unlocksAtRarity: ItemRarity.COMMON },
  { statType: StatType.MAGIC_DAMAGE_MAX, baseValue: 10, unlocksAtRarity: ItemRarity.UNCOMMON },
  { statType: StatType.GOLD_FIND, baseValue: 15, unlocksAtRarity: ItemRarity.EPIC },
  { statType: StatType.EXPERIENCE_GAIN, baseValue: 10, unlocksAtRarity: ItemRarity.LEGENDARY },
]);
```

---

## Testing

### Run Example Setup
```bash
npx tsx scripts/setupStatProgressions.ts
```

This configures progressions for:
- Wooden Sword (id: 19)
- Gold Helmet (id: 25)
- Silver Revolver (id: 23)

### Test Creating Items

Use the test form at `/api/test/add-item`:
```typescript
// Create COMMON Wooden Sword
POST /api/test/add-item
{
  itemId: 19,
  rarity: "COMMON"
}
// Result: 1 stat (CRITICAL_CHANCE: 5)

// Create MYTHIC Wooden Sword  
POST /api/test/add-item
{
  itemId: 19,
  rarity: "MYTHIC"
}
// Result: 2 stats (CRITICAL_CHANCE: 13.5, ATTACK_SPEED: 0.27)
```

### Test Upgrading

1. Create COMMON item
2. Upgrade through rarities
3. Check when new stats appear
4. Verify values are multiplied correctly

---

## Important Notes

### ✅ Guaranteed Consistency
- **All items of same template + same rarity = identical stats**
- No randomness in stat values
- No "luckier" rolls

### ✅ Unlimited Stats
- Not limited to 2 stats anymore
- Can have 10+ stats at high rarities
- CSV export/import still limited to 2 for simplicity

### ✅ Backward Compatible
- Old `ItemStat` system still works
- Items without progressions use old system
- Can migrate gradually

### ⚠️ Balance Considerations
- Don't unlock too many stats early
- Higher rarities should feel rewarding
- Consider: COMMON (1-2 stats), RARE (2-3), EPIC (3-4), LEGENDARY+ (4-6)

### ⚠️ Multiplier Stacking
- Higher rarities have higher multipliers
- Stats unlock AND get multiplied
- Example: DIVINE attack speed = 0.1 × 3.0 = 0.3 (very strong)

---

## Quick Reference

| Function | Purpose |
|----------|---------|
| `setItemStatProgressions(itemId, progressions)` | Define all progressions for item |
| `addStatProgression(itemId, statType, baseValue, unlocksAtRarity)` | Add single progression |
| `getItemStatProgressions(itemId)` | View current progressions |
| `createUserItem(userId, itemId, rarity)` | Auto-applies progressions |
| `upgradeUserItemRarity(userItemId, userId)` | Auto-unlocks new stats |

---

## Next Steps

1. ✅ Run `scripts/setupStatProgressions.ts` to configure example items
2. ✅ Test creating items with different rarities
3. ✅ Test upgrading items and verify stat unlocking
4. 📝 Define progressions for all your items
5. 📝 Update item balancing based on progression system
6. 📝 Consider adding admin UI for managing progressions

---

**System is ready to use!** Items of same type and rarity will now have identical, predictable stats.
