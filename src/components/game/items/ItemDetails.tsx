"use client";

import { forwardRef, useRef } from "react";
import Image from "next/image";
import { PopoverContent } from "~/components/ui/popover";
import { formatDuration } from "~/components/game/actions/format";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { useUserContext } from "~/context/userContext";
import { ItemType, type ItemRarity } from "~/generated/prisma/enums";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { cn } from "~/lib/utils";
import type { ItemWithStats } from "~/types/stats";
import { meetsItemLevelRequirement } from "~/utils/inventoryClient";
import { rarityStyle } from "~/utils/rarity-colors";
import { formatItemStatsForDisplay } from "~/utils/stats";
import { RarityBadge } from "~/utils/ui/rarity-badge";

/** What an item card shows: an owned item, or a template at a given rarity. */
export type ItemDetailsData = Pick<
  ItemWithStats,
  | "name"
  | "sprite"
  | "rarity"
  | "itemType"
  | "equipTo"
  | "requiredLevel"
  | "description"
  | "price"
  | "foodEffectSeconds"
  | "foodEffectStats"
> & {
  stats: Array<Pick<ItemWithStats["stats"][number], "statType" | "value">>;
};

export function itemHasTimedEffect(itemType: ItemType | null | undefined) {
  return (
    itemType === ItemType.FOOD ||
    itemType === ItemType.POTION ||
    itemType === ItemType.ELIXIR
  );
}

/** The item card body, shared by the inventory popup and item popups everywhere else. */
export function ItemDetails({ item }: { item: ItemDetailsData }) {
  const { user } = useUserContext();
  const meetsLevel = meetsItemLevelRequirement(item, user?.level ?? 0);

  return (
    <>
      <div className="game-item-detail-header">
        <div
          className="game-item-detail-art rarity-frame"
          data-rarity={item.rarity}
        >
          <Image
            alt=""
            src={item.sprite}
            width={80}
            height={80}
            className="h-full w-full rounded-lg object-contain"
          />
        </div>
        <div className="min-w-0">
          <RarityBadge rarity={item.rarity} />
          <h3 className="game-item-name mt-2 text-lg font-semibold leading-tight">
            {item.name}
          </h3>
          {/* {item.equipTo && (
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {item.equipTo.replace(/([a-z])([A-Z])/g, "$1 $2")}
            </p>
          )} */}
          <p className="mt-1 text-xs capitalize text-muted-foreground">
          {item.itemType
            ?.replace(/_/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .toLowerCase()
            .replace(/\b\w/g, (char) => char.toUpperCase())}
          </p>
        </div>
      </div>
      {item.equipTo && (
        <p
          className={cn(
            "mb-3 text-xs",
            user && !meetsLevel ? "text-danger" : "text-muted-foreground",
          )}
        >
          Requires level {item.requiredLevel ?? 1}
        </p>
      )}
      {item.description && (
        <p className="mb-4 text-sm leading-relaxed text-text-secondary">
          {item.description}
        </p>
      )}
      {itemHasTimedEffect(item.itemType) &&
      item.foodEffectSeconds &&
      (item.foodEffectStats?.length ?? 0) > 0 ? (
        <div className="mb-4 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-foreground">Timed effect</span>
            <span className="tabular-nums text-muted-foreground">
              {formatDuration(item.foodEffectSeconds)}
            </span>
          </div>
          <ul className="space-y-1">
            {formatItemStatsForDisplay(item.foodEffectStats ?? []).map(
              (stat) => (
                <li
                  key={stat.statType}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="font-semibold text-success">
                    {stat.value}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
      {item.stats && item.stats.length > 0 ? (
        <ul className="space-y-2">
          {formatItemStatsForDisplay(item.stats).map((stat, idx) => (
            <li key={idx} className="game-stat-row text-sm">
              <span className="text-muted-foreground">{stat.label}</span>
              <span className="font-semibold tabular-nums">{stat.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Value</span>
          <span className="text-sm text-currency">
            <CoinsIcon /> {item.price}
          </span>
        </div>
      </div>
    </>
  );
}

/** The popup around an item card: rarity-tinted, focusable, same everywhere. */
export const ItemDetailsPopoverContent = forwardRef<
  HTMLDivElement,
  {
    name: string;
    rarity: ItemRarity;
    onCloseAutoFocus?: (event: Event) => void;
    children: React.ReactNode;
  }
>(function ItemDetailsPopoverContent(
  { name, rarity, onCloseAutoFocus, children },
  forwardedRef,
) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { colors } = useRarityColors();

  return (
    <PopoverContent
      ref={(node) => {
        contentRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      tabIndex={-1}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        contentRef.current?.focus({ preventScroll: true });
      }}
      onCloseAutoFocus={onCloseAutoFocus}
      className="game-item-details w-[360px] rounded-2xl p-5"
      aria-label={`${name} details`}
      style={rarityStyle(rarity, colors[rarity])}
      data-rarity={rarity}
    >
      {children}
    </PopoverContent>
  );
});
