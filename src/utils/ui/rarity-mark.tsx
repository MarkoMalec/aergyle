import {
  Circle,
  CircleDashed,
  Crown,
  Diamond,
  Flame,
  Gem,
  Hexagon,
  Leaf,
  Sparkle,
  Star,
  Sun,
  Unlink,
} from "lucide-react";
import type { ItemRarity } from "~/generated/prisma/enums";

const rarityIcons = {
  WORTHLESS: CircleDashed,
  BROKEN: Unlink,
  COMMON: Circle,
  UNCOMMON: Leaf,
  RARE: Diamond,
  EXQUISITE: Gem,
  EPIC: Sparkle,
  ELITE: Star,
  UNIQUE: Hexagon,
  LEGENDARY: Crown,
  MYTHIC: Flame,
  DIVINE: Sun,
};

/** Shape complements colour; the containing item/badge supplies the readable name. */
export function RarityMark({
  rarity,
  className,
}: {
  rarity: ItemRarity;
  className?: string;
}) {
  const Icon = rarityIcons[rarity];
  return <Icon className={className} aria-hidden="true" strokeWidth={1.8} />;
}

export function ItemRarityMark({ rarity }: { rarity: ItemRarity }) {
  if (
    ["WORTHLESS", "BROKEN", "COMMON", "UNCOMMON", "RARE", "EXQUISITE"].includes(
      rarity,
    )
  )
    return null;
  return (
    <span className="game-item-rarity-mark">
      <RarityMark rarity={rarity} />
    </span>
  );
}
