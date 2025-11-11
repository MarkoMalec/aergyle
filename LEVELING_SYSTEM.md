# Leveling System Documentation

## Overview

A highly flexible and configurable leveling system with progressive difficulty, XP multipliers, and soft/hard level caps.

## Features

### 1. **Configurable XP Curve**
- Database-driven configuration (no code changes needed)
- Exponential growth with customizable parameters
- Multiple difficulty brackets

### 2. **Difficulty Brackets**
- **Easy (1-5)**: 80% XP requirement
- **Normal (6-15)**: 100% XP requirement  
- **Hard (16-30)**: 130% XP requirement
- **Very Hard (31-50)**: 180% XP requirement
- **Extreme (51-62)**: 300% XP requirement
- **Soft Cap (63-70)**: 1000% XP (nearly impossible)

### 3. **XP Multipliers**
- Temporary boosts from items, events, cards
- Stackable or non-stackable options
- Duration-based or use-limited
- Action-specific or global

### 4. **Level Caps**
- **Soft Cap**: Makes leveling extremely difficult
- **Hard Cap**: Absolute maximum level
- Easy to adjust for seasons/expansions

## Usage Examples

### Award XP to a Player

```typescript
import { awardXp } from "~/utils/leveling";
import { XpActionType } from "@prisma/client";

const result = await awardXp(
  userId,
  100,                          // Base XP amount
  XpActionType.COMBAT,          // Action type
  "Killed Goblin",              // Description
  { monsterId: 123 }            // Optional metadata
);

if (result.leveledUp) {
  console.log(`Level up! ${result.oldLevel} → ${result.newLevel}`);
}
```

### Add Temporary XP Boost

```typescript
import { addXpMultiplier } from "~/utils/leveling";
import { XpActionType } from "@prisma/client";

// 10% XP boost for 60 minutes
await addXpMultiplier(userId, "XP Boost Card", 1.1, {
  durationMinutes: 60,
  stackable: true
});

// 50% XP boost for combat only, 10 uses
await addXpMultiplier(userId, "Combat XP Card", 1.5, {
  actionType: XpActionType.COMBAT,
  uses: 10,
  stackable: false
});
```

### Get Player Progress

```typescript
import { getXpProgress } from "~/utils/leveling";

const progress = await getXpProgress(userId);
// {
//   level: 12,
//   currentXp: 450,
//   xpForNextLevel: 1000,
//   xpProgress: 45,        // 45%
//   xpRemaining: 550
// }
```

### Check XP Required for Level

```typescript
import { getXpRequiredForLevel } from "~/utils/leveling";

const xpNeeded = await getXpRequiredForLevel(50);
console.log(`Level 50 requires ${xpNeeded} XP`);
```

## Database Models

### XpConfig
Main configuration table. Only one config can be `isActive` at a time.

```prisma
model XpConfig {
  id                    Int
  configName            String   // "default", "season1", etc.
  isActive              Boolean
  
  // Base formula
  baseXp                Float    // Starting XP (default: 100)
  exponentMultiplier    Float    // Curve steepness (default: 1.5)
  levelMultiplier       Float    // Additional scaling (default: 1.0)
  
  // Difficulty brackets
  easyLevelCap          Int      // Level 5
  easyMultiplier        Float    // 0.8 (80%)
  // ... more brackets
  
  // Caps
  softCapLevel          Int      // Level 62
  softCapMultiplier     Float    // 10.0 (1000%)
  hardCapLevel          Int      // Level 70
  
  // Seasonal bonus
  seasonalBonus         Float    // 0.1 = 10% less XP needed
}
```

### XpMultiplier
Temporary XP boosts for players.

```prisma
model XpMultiplier {
  id              Int
  userId          String
  name            String           // Display name
  multiplier      Float            // 1.1 = 10% more XP
  actionType      XpActionType?    // null = all actions
  expiresAt       DateTime?        // null = permanent
  usesRemaining   Int?             // null = unlimited
  isActive        Boolean
  stackable       Boolean
}
```

### XpTransaction
Complete audit log of all XP gains.

```prisma
model XpTransaction {
  id                Int
  userId            String
  amount            Float           // Base XP
  finalAmount       Float           // After multipliers
  actionType        XpActionType
  levelBefore       Int
  levelAfter        Int
  experienceBefore  Float
  experienceAfter   Float
  description       String?
  metadata          Json?
  createdAt         DateTime
}
```

## Action Types

Available `XpActionType` enum values:

- `COMBAT` - Killing monsters
- `QUEST` - Completing quests
- `CRAFTING` - Crafting items
- `GATHERING` - Resource gathering
- `SKILL` - Training skills
- `EXPLORATION` - Discovering areas
- `DUNGEON` - Completing dungeons
- `BOSS` - Defeating bosses
- `PVP` - Player vs Player
- `TRADE` - Trading
- `ACHIEVEMENT` - Unlocking achievements
- `DAILY` - Daily activities
- `EVENT` - Special events

## Changing the XP Curve

### Option 1: Update Active Config (Recommended)

```typescript
import { prisma } from "~/lib/prisma";

await prisma.xpConfig.updateMany({
  where: { isActive: true },
  data: {
    // Make leveling easier
    easyLevelCap: 10,           // Extend easy levels to 10
    easyMultiplier: 0.6,        // Even easier (60% XP)
    
    // Adjust soft cap
    softCapLevel: 70,           // Move soft cap to 70
    hardCapLevel: 80,           // New hard cap at 80
  }
});
```

### Option 2: Create New Season Config

```typescript
await prisma.xpConfig.updateMany({
  where: { isActive: true },
  data: { isActive: false }
});

await prisma.xpConfig.create({
  data: {
    configName: "season2",
    isActive: true,
    baseXp: 120,              // Slightly harder
    softCapLevel: 70,         // Raise cap for season
    hardCapLevel: 80,
    seasonalBonus: 0.2,       // 20% XP boost for season
    // ... other settings
  }
});
```

## API Routes

### POST `/api/leveling/award-xp`
```json
{
  "userId": "user123",
  "amount": 100,
  "actionType": "COMBAT",
  "description": "Killed Dragon"
}
```

### POST `/api/leveling/add-multiplier`
```json
{
  "userId": "user123",
  "name": "Weekend Event",
  "multiplier": 2.0,
  "durationMinutes": 2880
}
```

### GET `/api/admin/leveling/table`
Returns full XP table for visualization.

## Testing

Visit `/admin/leveling` to see the full XP curve visualization with all brackets color-coded.

## Future Ideas

### Prestige System
```typescript
// Reset to level 1 but keep prestige bonuses
await prisma.user.update({
  where: { id: userId },
  data: {
    level: 1,
    experience: 0,
    prestigeLevel: { increment: 1 }
  }
});
```

### Seasonal Resets
```typescript
// Create new season config with raised caps
await createSeasonConfig("season3", {
  softCapLevel: 80,
  hardCapLevel: 90,
  seasonalBonus: 0.25  // 25% boost for comeback players
});
```

### Dynamic Events
```typescript
// Double XP Weekend
await addXpMultiplier(userId, "Double XP Weekend", 2.0, {
  durationMinutes: 4320  // 3 days
});
```
