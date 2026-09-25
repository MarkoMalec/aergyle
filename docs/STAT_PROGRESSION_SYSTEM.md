# Stat Progression System

A stat progression gives an item template a stat that only appears from a
given rarity upward. Progressions are live balance data: they are resolved
whenever an item's stats are read, never copied onto the player's item, so an
edit applies to every existing copy.

## Database Schema

```prisma
model ItemStatProgression {
  id              Int        @id @default(autoincrement())
  itemId          Int        // Which item template
  statType        StatType   // Which stat (CRITICAL_CHANCE, etc.)
  baseValue       Float      // Base value before rarity multiplier
  unlocksAtRarity ItemRarity // When this stat becomes available

  item Item @relation(fields: [itemId], references: [id])

  @@unique([itemId, statType])
}
```

Stats are resolved by `resolveEffectiveItemStats` (`src/utils/itemInstanceStats.ts`),
reached through `hydrateEffectiveItemStats` (`src/server/items/effectiveStats.ts`).

## Example Progression

**Wooden Sword:**
```
statType,baseValue,unlocksAtRarity
CRITICAL_CHANCE,5,COMMON
ATTACK_SPEED,0.1,MYTHIC
LIFESTEAL,3,DIVINE
```

**What Players Get:**

| Rarity | Stats |
|--------|-------|
| COMMON (1.0x) | CRITICAL_CHANCE: 5 |
| RARE (1.35x) | CRITICAL_CHANCE: 6.75 |
| MYTHIC (2.7x) | CRITICAL_CHANCE: 13.5, **ATTACK_SPEED: 0.27** ⭐ |
| DIVINE (3.0x) | CRITICAL_CHANCE: 15, ATTACK_SPEED: 0.3, **LIFESTEAL: 9** ⭐ |

**Key Point:** All MYTHIC Wooden Swords have identical stats. No RNG.

## Configuring Progressions

Edit the item in the admin item editor (`/admin/items`). Its stat progressions
are saved as the CSV above (`statType,baseValue,unlocksAtRarity`); saving
replaces the item's progressions. The bulk CSV import on the admin dashboard
(`/admin`) writes them too.

## Testing

Grant yourself the item at different rarities from the profile page's
development tools (`POST /api/test/add-item`) and compare the stats shown.

## Important Notes

### ✅ Guaranteed Consistency
- **All items of same template + same rarity = identical stats**
- No randomness in stat values

### ⚠️ Balance Considerations
- Don't unlock too many stats early
- Higher rarities should feel rewarding
- Consider: COMMON (1-2 stats), RARE (2-3), EPIC (3-4), LEGENDARY+ (4-6)

### ⚠️ Multiplier Stacking
- Higher rarities have higher multipliers
- Stats unlock AND get multiplied
- Example: DIVINE attack speed = 0.1 × 3.0 = 0.3 (very strong)
