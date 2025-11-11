# CARRYING_CAPACITY System - Implementation Summary

## Overview

The CARRYING_CAPACITY system dynamically adjusts inventory size based on equipped items (primarily backpacks).

**Key Features:**
- ✅ Base inventory: **25 slots**
- ✅ Equipped items with CARRYING_CAPACITY stat add bonus slots
- ✅ Automatic recalculation when equipment changes
- ✅ Works with item rarity system (higher rarity = more capacity)
- ✅ No limit on total capacity

---

## How It Works

### Base System
```typescript
Total Inventory Slots = 25 (base) + CARRYING_CAPACITY bonuses from equipped items
```

### Example: Backpack Progression
```
XL Backpack (baseValue: 5 for CARRYING_CAPACITY)

COMMON (1.0x):     5 × 1.0 = 5   → 25 + 5  = 30 slots
RARE (1.35x):      5 × 1.35 = 6.75 → 25 + 6  = 31 slots (rounded down)
EPIC (1.7x):       5 × 1.7 = 8.5  → 25 + 8  = 33 slots
LEGENDARY (2.3x):  5 × 2.3 = 11.5 → 25 + 11 = 36 slots
DIVINE (3.0x):     5 × 3.0 = 15   → 25 + 15 = 40 slots
```

### Multiple Items
If multiple equipped items have CARRYING_CAPACITY (rare, but possible):
```
Belt with +2 CARRYING_CAPACITY
Backpack with +5 CARRYING_CAPACITY
→ Total: 25 + 2 + 5 = 32 slots
```

---

## Database Changes

### ✅ Added StatType
```prisma
enum StatType {
  // ... existing stats
  CARRYING_CAPACITY  // NEW
}
```

### ✅ Updated Inventory Default
```prisma
model Inventory {
  maxSlots Int @default(25)  // Changed from 20 to 25
}
```

---

## Files Modified/Created

### Core Utilities
**`src/utils/inventoryCapacity.ts`** - NEW
- `calculateInventoryCapacity(userId)` - Calculate total capacity
- `updateInventoryCapacity(userId)` - Update database
- `getInventoryCapacity(userId)` - Get detailed capacity info
- `hasInventorySpace(userId, slots)` - Check if space available

### API Updates
**`src/app/api/equipment/route.ts`** - MODIFIED
- POST endpoint now calls `updateInventoryCapacity()` after equipment changes
- Automatically recalculates when backpack equipped/unequipped

**`src/app/api/inventory/route.ts`** - MODIFIED
- GET endpoint now returns `capacity` object with:
  - `current`: Number of filled slots
  - `max`: Total available slots
  - `base`: Base capacity (25)
  - `bonus`: Bonus from equipped items

### Migration Scripts
**`scripts/updateInventoryBase25.ts`** - NEW
- Updates all existing inventories from 20 → 25 slots
- Expands JSON slots array if needed

**`scripts/setupBackpackCapacity.ts`** - NEW
- Example: Configure XL Backpack with CARRYING_CAPACITY stat progression

---

## Setup Instructions

### 1. Run Prisma Migration
```bash
npx prisma migrate dev --name add_carrying_capacity_stat
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Update Existing Inventories
```bash
npx tsx scripts/updateInventoryBase25.ts
```

This updates all inventories from 20 slots → 25 slots.

### 4. Configure Backpacks
```bash
npx tsx scripts/setupBackpackCapacity.ts
```

This sets up XL Backpack (id: 35) with CARRYING_CAPACITY progression.

### 5. Create Backpacks for Testing
```typescript
import { createUserItem } from "~/utils/userItems";
import { ItemRarity } from "@prisma/client";

// Create COMMON XL Backpack
const backpackId = await createUserItem(
  userId,
  35, // XL Backpack template
  ItemRarity.COMMON
);
// Result: Has CARRYING_CAPACITY: 5 stat
```

### 6. Test Equipping
```typescript
// Equip backpack (via DnD or API)
await fetch("/api/equipment", {
  method: "POST",
  body: JSON.stringify({
    userId: "player1",
    equipment: {
      backpack: backpackId, // UserItem ID
      // ... other slots
    },
  }),
});

// Equipment API automatically calls updateInventoryCapacity()
// Inventory now has 30 slots (25 base + 5 from backpack)
```

---

## API Response Changes

### Inventory GET Response
```typescript
// Before:
{
  slots: [...],
  deleteSlot: {...}
}

// After:
{
  slots: [...],
  deleteSlot: {...},
  capacity: {
    current: 12,  // Slots currently filled
    max: 30,      // Total available slots
    base: 25,     // Base capacity
    bonus: 5      // Bonus from equipped items
  }
}
```

---

## Configuring Different Backpacks

### Small Backpack (+3 slots at COMMON)
```typescript
await setItemStatProgressions(itemId, [
  {
    statType: StatType.CARRYING_CAPACITY,
    baseValue: 3,
    unlocksAtRarity: ItemRarity.COMMON,
  },
]);

// Results:
// COMMON: 25 + 3 = 28 slots
// DIVINE: 25 + 9 = 34 slots
```

### Medium Backpack (+5 slots at COMMON)
```typescript
await setItemStatProgressions(itemId, [
  {
    statType: StatType.CARRYING_CAPACITY,
    baseValue: 5,
    unlocksAtRarity: ItemRarity.COMMON,
  },
]);

// Results:
// COMMON: 25 + 5 = 30 slots
// DIVINE: 25 + 15 = 40 slots
```

### Large Backpack (+7 slots at COMMON)
```typescript
await setItemStatProgressions(itemId, [
  {
    statType: StatType.CARRYING_CAPACITY,
    baseValue: 7,
    unlocksAtRarity: ItemRarity.COMMON,
  },
]);

// Results:
// COMMON: 25 + 7 = 32 slots
// DIVINE: 25 + 21 = 46 slots
```

### XL Backpack (+10 slots at COMMON)
```typescript
await setItemStatProgressions(itemId, [
  {
    statType: StatType.CARRYING_CAPACITY,
    baseValue: 10,
    unlocksAtRarity: ItemRarity.COMMON,
  },
]);

// Results:
// COMMON: 25 + 10 = 35 slots
// DIVINE: 25 + 30 = 55 slots
```

---

## Edge Cases Handled

### No Backpack Equipped
- ✅ Capacity = 25 (base)
- ✅ No errors

### Backpack Without CARRYING_CAPACITY
- ✅ Capacity = 25 (base)
- ✅ Backpack is still equipped, just doesn't add bonus

### Multiple CARRYING_CAPACITY Items
- ✅ All bonuses are summed
- ✅ Example: Belt (+2) + Backpack (+5) = +7 total

### Inventory Full After Unequipping Backpack
**Problem:** Player has 30 slots filled, unequips backpack, capacity drops to 25.

**Current behavior:** Capacity updates to 25, but items beyond slot 25 are still in database.

**Solution (to implement later):**
```typescript
// When unequipping, check if items would exceed new capacity
const newCapacity = await calculateInventoryCapacity(userId);
const filledSlots = countFilledSlots(userId);

if (filledSlots > newCapacity) {
  // Option 1: Block unequip
  throw new Error("Remove items first (inventory too full)");
  
  // Option 2: Send excess to mailbox
  await moveExcessItemsToMailbox(userId, newCapacity);
  
  // Option 3: Drop excess items
  await dropExcessItems(userId, newCapacity);
}
```

---

## Testing Checklist

- [x] CARRYING_CAPACITY stat type added to enum
- [x] Default inventory size changed to 25
- [x] `calculateInventoryCapacity()` function created
- [x] `updateInventoryCapacity()` called on equipment change
- [x] Inventory API returns capacity info
- [x] Migration script to update existing inventories
- [x] Example backpack configuration script

**Manual Testing:**
1. [ ] Create player with fresh inventory → verify 25 slots
2. [ ] Create COMMON backpack → verify CARRYING_CAPACITY stat exists
3. [ ] Equip backpack → verify inventory expands to 30+ slots
4. [ ] Unequip backpack → verify inventory returns to 25 slots
5. [ ] Upgrade backpack rarity → verify capacity increases
6. [ ] Equip multiple items with CARRYING_CAPACITY → verify bonuses stack

---

## Future Enhancements

### 1. UI Display
Show capacity in inventory UI:
```tsx
<div className="inventory-header">
  Inventory: {capacity.current}/{capacity.max}
  {capacity.bonus > 0 && (
    <span className="text-green-500">
      (+{capacity.bonus} from equipment)
    </span>
  )}
</div>
```

### 2. Overflow Protection
Prevent unequipping backpack if it would make inventory too full:
```typescript
if (newCapacity < currentFilledSlots) {
  return { error: "Inventory too full to remove backpack" };
}
```

### 3. Other Items with CARRYING_CAPACITY
- Utility belts: +2-3 slots
- Magical pouches: +1-2 slots
- Special cloaks: +3-5 slots

### 4. Negative CARRYING_CAPACITY
Cursed items that reduce capacity:
```typescript
{
  statType: StatType.CARRYING_CAPACITY,
  baseValue: -5, // Reduces capacity
  unlocksAtRarity: ItemRarity.COMMON,
}
```

---

## Quick Reference

| Function | Purpose |
|----------|---------|
| `calculateInventoryCapacity(userId)` | Calculate total slots (base + bonuses) |
| `updateInventoryCapacity(userId)` | Update Inventory.maxSlots in database |
| `getInventoryCapacity(userId)` | Get current/max/base/bonus info |
| `hasInventorySpace(userId, slots)` | Check if space available |

| Value | Description |
|-------|-------------|
| 25 | Base inventory capacity |
| CARRYING_CAPACITY | StatType for bonus slots |
| Equipment.backpackItemId | Primary source of capacity bonus |

---

**System is ready!** Backpacks now dynamically increase inventory size based on rarity.
