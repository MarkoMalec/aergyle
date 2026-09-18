"use client";

import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import type { ItemRarity } from "~/generated/prisma/enums";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { rarityStyle } from "~/utils/rarity-colors";
import { RarityMark } from "~/utils/ui/rarity-mark";
import { ItemInfoPopover } from "~/components/game/items/ItemInfoPopover";

export function CreatureLootTile(props: {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  requirement: string | null;
}) {
  const { colors } = useRarityColors();
  return (
    <li
      className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3"
      style={rarityStyle(props.rarity, colors[props.rarity])}
    >
      <ItemInfoPopover
        itemId={props.itemId}
        rarity={props.rarity}
        name={props.name}
        className="rounded-xl"
      >
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl"
          style={{
            background:
              "radial-gradient(circle at 50% 100%, color-mix(in srgb, var(--rarity-color) 32%, transparent), transparent 75%), hsl(var(--surface-inset))",
          }}
        >
          <Image
            src={props.sprite}
            alt=""
            width={56}
            height={56}
            className="h-12 w-12 object-contain"
          />
        </span>
      </ItemInfoPopover>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm">{props.name}</strong>
        <span
          className="flex items-center gap-1 text-xs capitalize"
          style={{ color: "var(--rarity-text)" }}
        >
          <RarityMark rarity={props.rarity} className="h-3 w-3" />
          {props.rarity.toLowerCase()}
        </span>
        {props.requirement ? (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <LockKeyhole className="h-3 w-3" aria-hidden="true" />
            {props.requirement}
          </span>
        ) : null}
      </span>
    </li>
  );
}
