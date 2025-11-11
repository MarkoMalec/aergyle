# Rarity Color System - Implementation

## Summary
The rarity badge now uses colors from the `RarityConfig` database table, fetched via API and cached with React Query.

## Dynamic Database-Driven Approach

### Why This Approach:
1. **Database is Source of Truth** - Colors come from `RarityConfig` table
2. **Live Updates** - Change colors in DB, see changes in app (after cache expires)
3. **Efficient Caching** - React Query caches for 1 hour, CDN caches for 1 hour
4. **Fallback Support** - Static colors used if API fails
5. **Type-Safe** - Uses TypeScript enums and Record types

## Files Changed

### 1. `/src/app/api/rarity/colors/route.ts` (NEW)
- API endpoint that fetches colors from `RarityConfig` table
- Returns JSON with color mapping
- Cached with HTTP headers (1 hour CDN cache)

### 2. `/src/hooks/use-rarity-colors.ts` (NEW)
- React Query hook to fetch and cache colors
- Caches for 1 hour client-side
- Falls back to static colors if API fails

### 3. `/src/utils/rarity-colors.ts` (NEW)
- Exports `FALLBACK_RARITY_COLORS` - static fallback colors
- Exports `hexToTailwindClass()` - converts hex to Tailwind classes
- Exports `getRarityTailwindClass()` - main function for badge styling

### 4. `/src/utils/rarity.ts` (UPDATED)
- Added `RARITY_COLORS` export (used for DB initialization)
- Added `getRarityColorsFromDB()` - fetches colors from database
- Updated `initializeRarityConfigs()` to use `RARITY_COLORS` constant

### 5. `/src/utils/ui/rarity-badge.tsx` (UPDATED)
- Now uses `useRarityColors()` hook to fetch colors from DB
- Converts "use client" component
- Falls back gracefully if fetch fails

## How It Works

```typescript
// 1. Colors stored in database (RarityConfig table)
// Via initializeRarityConfigs() or manual DB updates

// 2. API endpoint fetches from database
// GET /api/rarity/colors
// Returns: { colors: { MYTHIC: "#ef4444", ... } }

// 3. React Query hook caches the result
const { colors } = useRarityColors() // Cached 1 hour

// 4. Badge component uses live colors
<RarityBadge rarity="MYTHIC" /> // Uses color from DB
```

## Data Flow

```
┌─────────────────┐
│ RarityConfig DB │ ← Source of truth
└────────┬────────┘
         │
         ↓ (API fetch)
┌─────────────────┐
│ /api/rarity/    │ ← HTTP caching (1hr)
│ colors          │
└────────┬────────┘
         │
         ↓ (React Query)
┌─────────────────┐
│ useRarityColors │ ← Client cache (1hr)
│ hook            │
└────────┬────────┘
         │
         ↓ (Component)
┌─────────────────┐
│ RarityBadge     │ ← Renders with DB colors
└─────────────────┘
```

## Usage Examples

### Basic Badge Usage
```tsx
import { RarityBadge } from "~/utils/ui/rarity-badge"

<RarityBadge rarity="LEGENDARY" />
```

### Custom Styling with Hex Colors
```tsx
import { RARITY_COLORS } from "~/utils/rarity-colors"

<div style={{ color: RARITY_COLORS.EPIC }}>
  Epic Item Name
</div>
```

### Custom Badge with Tailwind
```tsx
import { getRarityTailwindClass } from "~/utils/rarity-colors"

const customClass = getRarityTailwindClass(item.rarity)
<Badge className={customClass}>Custom Badge</Badge>
```

## Alternative Approaches Considered

### ❌ Option 2: Database Query Per Render
```typescript
// Would query DB on every component render
const { data } = await prisma.rarityConfig.findUnique({ 
  where: { rarity } 
})
```
**Cons:** 
- Slow (DB query per badge)
- Doesn't work in client components
- Unnecessary load on database

### ❌ Option 3: Context Provider with Initial Fetch
```typescript
// Fetch once, provide via context
const RarityProvider = () => {
  const [colors] = useState(() => fetchRarityColors())
  // ...
}
```
**Cons:**
- Extra complexity
- Still requires initial async fetch
- Overkill for static data

### ✅ Option 1: Static Export (CHOSEN)
**Pros:**
- Zero runtime overhead
- Works everywhere (client/server)
- Type-safe
- Easy to maintain (one place to update)
- Stays in sync with database via shared constant

## Maintenance

### To Update Colors in Database:
```sql
-- Update color directly in database
UPDATE RarityConfig 
SET color = '#ff0000' 
WHERE rarity = 'MYTHIC';
```

**Changes take effect after cache expires** (1 hour), or you can:
- Clear React Query cache: refresh page
- Clear CDN cache: wait 1 hour or invalidate manually

### To Add Custom Tailwind Mapping:
If you add a new color that doesn't have a Tailwind equivalent:

```typescript
// In src/utils/rarity-colors.ts
export function hexToTailwindClass(hex: string): string {
  const colorMap: Record<string, string> = {
    "#ff0000": "bg-red-600 text-white border-red-700", // Add new mapping
    // ...
  };
}
```

### To Add New Rarity:
1. Add to `ItemRarity` enum in `schema.prisma`
2. Add to `RARITY_COLORS` in `rarity.ts` (for DB init)
3. Add Tailwind mapping in `hexToTailwindClass()` if custom color
4. Run `prisma generate && npm run db:seed`

## Performance

- **First Load:** 1 API request to fetch colors
- **Subsequent Renders:** 0 requests (React Query cache)
- **Cache Duration:** 1 hour client + 1 hour CDN
- **Fallback:** Static colors if API fails
- **Database Queries:** 1 query per API call (cached by CDN)

## Type Safety

All color mappings use `Record<ItemRarity, string>` ensuring:
- All rarities must have a color
- No typos in rarity names
- TypeScript errors if rarity added but color missing
