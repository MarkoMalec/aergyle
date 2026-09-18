"use client";

import type { ItemRarity } from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import { rarityStyle } from "~/utils/rarity-colors";
import { RarityMark } from "./rarity-mark";
import { useRarityColors } from "~/hooks/use-rarity-colors";

export function RarityBadge({
  rarity,
  className,
}: {
  rarity: ItemRarity;
  className?: string;
}) {
  const { colors } = useRarityColors();
  return (
    <span
      className={cn(
        "rarity-badge inline-flex items-center gap-1.5 border font-semibold capitalize",
        className,
      )}
      style={rarityStyle(rarity, colors[rarity])}
      data-rarity={rarity}
    >
      <RarityMark rarity={rarity} className="h-3.5 w-3.5" />
      {rarity.toLowerCase()}
    </span>
  );
}
