"use client";

import { useState } from "react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { ItemRarity } from "~/generated/prisma/enums";
import { formatGold, roundGold } from "~/lib/marketplace";
import { cn } from "~/lib/utils";
import { useSettlementAction } from "./useSettlementAction";

type SellableStack = {
  userItemId: number;
  rarity: ItemRarity;
  quantity: number;
  /** What this NPC pays for one: the item's value. */
  price: number;
  item: { id: number; name: string; sprite: string };
};

export function NpcSell(props: {
  npcId: number;
  npcName: string;
  inventory: SellableStack[];
}) {
  const { run, pending } = useSettlementAction();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const selected =
    props.inventory.find((stack) => stack.userItemId === selectedId) ?? null;

  if (props.inventory.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Your inventory is empty.</p>
    );
  }

  // Selling part of a stack refreshes it smaller, so never offer more than is left.
  const amount = selected
    ? Math.min(Math.max(1, quantity), selected.quantity)
    : 1;
  const total = selected ? roundGold(selected.price * amount) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-2">
        {props.inventory.map((stack) => (
          <button
            key={stack.userItemId}
            type="button"
            aria-pressed={stack.userItemId === selectedId}
            aria-label={`${stack.item.name}, ${stack.quantity}, worth ${formatGold(stack.price)} gold each`}
            onClick={() => {
              setSelectedId(stack.userItemId);
              setQuantity(stack.quantity);
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors hover:bg-secondary/40",
              stack.userItemId === selectedId && "bg-primary/15",
            )}
          >
            <ItemArtwork
              src={stack.item.sprite}
              name={stack.item.name}
              rarity={stack.rarity}
              size={52}
              quantity={stack.quantity > 1 ? stack.quantity : undefined}
            />
            <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-currency">
              <CoinsIcon size={12} />
              {formatGold(stack.price)}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/25 p-3">
          <ItemArtwork
            src={selected.item.sprite}
            name={selected.item.name}
            rarity={selected.rarity}
            size={44}
            itemId={selected.item.id}
          />
          <div className="min-w-0 flex-1 basis-40">
            <strong className="block truncate text-sm">
              {selected.item.name}
            </strong>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CoinsIcon size={14} />
              {formatGold(selected.price)} each · you have {selected.quantity}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              aria-label={`How many ${selected.item.name} to sell`}
              className="h-9 w-20"
              min={1}
              max={selected.quantity}
              value={amount}
              onChange={(event) => {
                const value = Math.floor(Number(event.target.value));
                setQuantity(Number.isFinite(value) ? value : 1);
              }}
            />
            <Button
              className="min-w-[128px]"
              disabled={pending !== null}
              onClick={() =>
                void run(
                  `sell:${selected.userItemId}`,
                  "/api/settlements/sell",
                  {
                    npcId: props.npcId,
                    userItemId: selected.userItemId,
                    quantity: amount,
                  },
                  () =>
                    `Sold ${selected.item.name} ×${amount} for ${formatGold(total)} gold`,
                )
              }
            >
              {pending ? (
                "Selling…"
              ) : (
                <span className="flex items-center gap-1">
                  Sell for <CoinsIcon size={16} /> {formatGold(total)}
                </span>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Choose an item to sell. {props.npcName} pays each item&apos;s value.
        </p>
      )}
    </div>
  );
}
