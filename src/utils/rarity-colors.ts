import type { CSSProperties } from "react";
import type { ItemRarity } from "~/generated/prisma/enums";

/**
 * FALLBACK rarity colors - used only if DB fetch fails
 * Real colors should come from RarityConfig table via API
 */
export const FALLBACK_RARITY_COLORS: Record<ItemRarity, string> = {
  WORTHLESS: "#4b5563", // Dark Gray
  BROKEN: "#92400e", // Brown
  COMMON: "#9ca3af", // Gray
  UNCOMMON: "#22c55e", // Green
  RARE: "#3b82f6", // Blue
  EXQUISITE: "#06b6d4", // Cyan
  EPIC: "#a855f7", // Purple
  ELITE: "#ec4899", // Pink
  UNIQUE: "#f59e0b", // Amber
  LEGENDARY: "#eab308", // Gold
  MYTHIC: "#ef4444", // Red
  DIVINE: "#f8fafc", // White
};

/**
 * Convert hex color to Tailwind class
 * This maps database hex colors to the closest Tailwind utility classes
 */
export function hexToTailwindClass(
  hex: string,
  variant: "badge" | "text" = "badge",
): string {
  const colorMap: Record<string, { badge: string; text: string }> = {
    "#4b5563": {
      badge: "bg-gray-600 text-white border-gray-700",
      text: "text-gray-600",
    },
    "#92400e": {
      badge: "bg-amber-900 text-white border-amber-950",
      text: "text-amber-900",
    },
    "#9ca3af": {
      badge: "bg-gray-400 text-gray-900 border-gray-500",
      text: "text-gray-400",
    },
    "#22c55e": {
      badge: "bg-green-500 text-white border-green-600",
      text: "text-green-500",
    },
    "#3b82f6": {
      badge: "bg-blue-500 text-white border-blue-600",
      text: "text-blue-500",
    },
    "#06b6d4": {
      badge: "bg-cyan-500 text-white border-cyan-600",
      text: "text-cyan-500",
    },
    "#a855f7": {
      badge: "bg-purple-500 text-white border-purple-600",
      text: "text-purple-500",
    },
    "#ec4899": {
      badge: "bg-pink-500 text-white border-pink-600",
      text: "text-pink-500",
    },
    "#f59e0b": {
      badge: "bg-amber-500 text-white border-amber-600",
      text: "text-amber-500",
    },
    "#eab308": {
      badge: "bg-yellow-500 text-gray-900 border-yellow-600",
      text: "text-yellow-500",
    },
    "#ef4444": {
      badge: "bg-red-500 text-white border-red-600",
      text: "text-red-500",
    },
    "#f8fafc": {
      badge: "bg-slate-50 text-gray-900 border-slate-200",
      text: "text-slate-50",
    },
  };

  const normalizedHex = hex.toLowerCase();
  const colors = colorMap[normalizedHex];

  if (!colors) {
    return variant === "badge"
      ? "bg-gray-400 text-gray-900 border-gray-500"
      : "text-gray-400";
  }

  return colors[variant];
}

/**
 * Get Tailwind-compatible color class for a rarity using hex color from DB
 * @param rarity - The item rarity
 * @param hexColor - Optional hex color from database
 * @param variant - "badge" for bg/border/text classes, "text" for text-only
 */
export function getRarityTailwindClass(
  rarity: ItemRarity,
  hexColor?: string,
  variant: "badge" | "text" = "badge",
): string {
  const color = hexColor || FALLBACK_RARITY_COLORS[rarity];
  return hexToTailwindClass(color, variant);
}

/** Aergyle's display palette. Legacy default DB colours resolve to these;
 * explicitly configured custom colours remain authoritative. No DB values change. */
export const RARITY_VISUALS: Record<
  ItemRarity,
  { color: string; rank: string }
> = {
  WORTHLESS: { color: "#A4AAA5", rank: "01" },
  BROKEN: { color: "#C69D82", rank: "02" },
  COMMON: { color: "#C1C8BD", rank: "03" },
  UNCOMMON: { color: "#78C995", rank: "04" },
  RARE: { color: "#79B9EB", rank: "05" },
  EXQUISITE: { color: "#70D7CF", rank: "06" },
  EPIC: { color: "#BD9AF7", rank: "07" },
  ELITE: { color: "#EB9CC6", rank: "08" },
  UNIQUE: { color: "#EEAE77", rank: "09" },
  LEGENDARY: { color: "#F2C66D", rank: "10" },
  MYTHIC: { color: "#FF9289", rank: "11" },
  DIVINE: { color: "#FFF0CA", rank: "12" },
};

export function resolveRarityColor(
  rarity: ItemRarity,
  custom?: string,
): string {
  if (
    !custom ||
    !/^#[\da-f]{6}$/i.test(custom) ||
    custom.toLowerCase() === FALLBACK_RARITY_COLORS[rarity].toLowerCase()
  ) {
    return RARITY_VISUALS[rarity].color;
  }
  return custom;
}

/** Keep custom frame colours, but use parchment if the same colour cannot be read on the tinted detail surface. */
export function resolveRarityTextColor(
  rarity: ItemRarity,
  custom?: string,
): string {
  const color = resolveRarityColor(rarity, custom);
  const rgb = [1, 3, 5].map((offset) =>
    parseInt(color.slice(offset, offset + 2), 16),
  );
  const background = [36, 52, 58].map(
    (channel, index) => channel * 0.88 + (rgb[index] ?? 0) * 0.12,
  );
  const luminance = (channels: number[]) =>
    channels.reduce((sum, value, index) => {
      const srgb = value / 255;
      const linear =
        srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
    }, 0);
  const foregroundLight = luminance(rgb);
  const backgroundLight = luminance(background);
  const contrast =
    (Math.max(foregroundLight, backgroundLight) + 0.05) /
    (Math.min(foregroundLight, backgroundLight) + 0.05);
  return contrast >= 4.5 ? color : "#EEE5D2";
}

export function rarityStyle(
  rarity: ItemRarity,
  custom?: string,
): CSSProperties {
  return {
    "--rarity-color": resolveRarityColor(rarity, custom),
    "--rarity-text": resolveRarityTextColor(rarity, custom),
  } as CSSProperties;
}
