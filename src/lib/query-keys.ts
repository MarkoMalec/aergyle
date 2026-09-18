/**
 * Centralized query keys for React Query
 * Prevents typos and makes refactoring easier
 *
 * Usage:
 * - useQuery({ queryKey: userQueryKeys.gold() })
 * - queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() })
 */

export const userQueryKeys = {
  gold: () => ["user-gold"] as const,
  all: () => ["user"] as const,
  level: (userId?: string) => ["user", "level", userId] as const,
} as const;

export const inventoryQueryKeys = {
  all: () => ["inventory"] as const,
  byUser: (userId?: string) => ["inventory", userId] as const,
  // Nested under byUser so every inventory invalidation also refreshes the sell list.
  sellable: (userId?: string) => ["inventory", userId, "sellable"] as const,
} as const;

export const gardenQueryKeys = {
  all: () => ["garden"] as const,
} as const;

export const itemQueryKeys = {
  details: (itemId: number, rarity: string) =>
    ["item-details", itemId, rarity] as const,
} as const;

export const recipeQueryKeys = {
  learned: (userId?: string) => ["recipes", "learned", userId] as const,
} as const;

export const foodEffectQueryKeys = {
  active: (userId?: string) => ["food-effect", "active", userId] as const,
} as const;

export const equipmentQueryKeys = {
  all: () => ["equipment"] as const,
  byUser: (userId?: string) => ["equipment", userId] as const,
} as const;

export const marketplaceQueryKeys = {
  all: () => ["marketplace"] as const,
  listings: (filters?: Record<string, any>) =>
    ["marketplace", filters] as const,
  myListings: (userId?: string) => ["my-listings", userId] as const,
  stats: (itemId: number, rarity: string) =>
    ["marketplace", "stats", itemId, rarity] as const,
} as const;

export const rarityQueryKeys = {
  colors: () => ["rarity-colors"] as const,
} as const;
