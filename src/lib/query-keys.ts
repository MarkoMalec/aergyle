/**
 * Centralized query keys for React Query
 * Prevents typos and makes refactoring easier
 * 
 * Usage:
 * - useQuery({ queryKey: userQueryKeys.gold() })
 * - queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() })
 */

export const userQueryKeys = {
  gold: (userId?: string) => ["user-gold", userId] as const,
  all: () => ["user"] as const,
} as const;

export const inventoryQueryKeys = {
  all: () => ["inventory"] as const,
  byUser: (userId: string) => ["inventory", userId] as const,
} as const;

export const marketplaceQueryKeys = {
  all: () => ["marketplace"] as const,
  listings: (filters?: Record<string, any>) => ["marketplace", filters] as const,
  myListings: (userId?: string) => ["my-listings", userId] as const,
  stats: (itemId: number, rarity: string) => ["marketplace", "stats", itemId, rarity] as const,
} as const;

export const rarityQueryKeys = {
  colors: () => ["rarity-colors"] as const,
} as const;
