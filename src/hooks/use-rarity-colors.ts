"use client";

import { useQuery } from "@tanstack/react-query";
import { ItemRarity } from "@prisma/client";
import { rarityQueryKeys } from "~/lib/query-keys";
import { FALLBACK_RARITY_COLORS } from "~/utils/rarity-colors";

interface RarityColorsResponse {
  colors: Record<ItemRarity, string>;
  timestamp: string;
}

/**
 * Hook to fetch rarity colors from database
 * Colors are cached for 1 hour
 * Use in combination with getRarityTailwindClass to get Tailwind classes
 */
export function useRarityColors() {
  const { data, isLoading, error } = useQuery<RarityColorsResponse>({
    queryKey: rarityQueryKeys.colors(),
    queryFn: async () => {
      const response = await fetch("/api/rarity/colors");
      if (!response.ok) {
        throw new Error("Failed to fetch rarity colors");
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
  });

  return {
    colors: data?.colors || FALLBACK_RARITY_COLORS,
    isLoading,
    error,
  };
}
