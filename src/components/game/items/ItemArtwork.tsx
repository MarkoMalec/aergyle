"use client";

import Image from "next/image";
import type { ItemRarity } from "~/generated/prisma/enums";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { rarityStyle } from "~/utils/rarity-colors";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";
import { ItemInfoPopover } from "./ItemInfoPopover";

export function ItemArtwork({
  src,
  name,
  rarity,
  size = 68,
  itemId,
}: {
  src: string;
  name: string;
  rarity: ItemRarity;
  size?: number;
  /** Item template id: clicking the artwork then opens the item's details card. */
  itemId?: number;
}) {
  const { colors } = useRarityColors();
  const artwork = (
    <div
      className="rarity-frame relative shrink-0 rounded-xl p-1"
      data-rarity={rarity}
      style={{
        ...rarityStyle(rarity, colors[rarity]),
        width: size,
        height: size,
      }}
    >
      <Image
        src={src}
        alt={`${name}, ${rarity.toLowerCase()}`}
        width={size}
        height={size}
        className="h-full w-full rounded-lg object-contain"
      />
      <ItemRarityMark rarity={rarity} />
    </div>
  );

  if (itemId === undefined) return artwork;

  return (
    <ItemInfoPopover
      itemId={itemId}
      rarity={rarity}
      name={name}
      className="rounded-xl"
    >
      {artwork}
    </ItemInfoPopover>
  );
}
