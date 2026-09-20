"use client";

import { useState } from "react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { ItemRarity } from "~/generated/prisma/enums";
import { formatGold, roundGold } from "~/lib/marketplace";
import { useSettlementAction } from "./useSettlementAction";

type Offer = {
  id: number;
  price: number;
  item: { id: number; name: string; sprite: string; rarity: ItemRarity };
};

const MAX_QUANTITY = 999;

export function NpcShop({ offers, gold }: { offers: Offer[]; gold: number }) {
  const { run, pending } = useSettlementAction();
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  if (offers.length === 0) {
    return <div className="game-empty-state">Nothing for sale right now.</div>;
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        You have
        <CoinsIcon size={18} />
        <strong className="text-currency">{formatGold(gold)}</strong>
      </p>
      <ul className="space-y-2">
        {offers.map((offer) => {
          const quantity = quantities[offer.id] ?? 1;
          const total = roundGold(offer.price * quantity);
          const affordable = total <= gold;
          return (
            <li
              key={offer.id}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/25 p-3"
            >
              <ItemArtwork
                src={offer.item.sprite}
                name={offer.item.name}
                rarity={offer.item.rarity}
                size={52}
                itemId={offer.item.id}
              />
              <div className="min-w-0 flex-1 basis-40">
                <strong className="block truncate text-sm">
                  {offer.item.name}
                </strong>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CoinsIcon size={14} />
                  {formatGold(offer.price)} each
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  aria-label={`Quantity of ${offer.item.name}`}
                  className="h-9 w-20"
                  min={1}
                  max={MAX_QUANTITY}
                  value={quantity}
                  onChange={(event) => {
                    const value = Math.floor(Number(event.target.value));
                    setQuantities((current) => ({
                      ...current,
                      [offer.id]: Number.isFinite(value)
                        ? Math.min(MAX_QUANTITY, Math.max(1, value))
                        : 1,
                    }));
                  }}
                />
                <Button
                  className="min-w-[128px]"
                  disabled={pending !== null || !affordable}
                  title={affordable ? undefined : "Not enough gold"}
                  onClick={() =>
                    void run(
                      `buy:${offer.id}`,
                      "/api/settlements/buy",
                      { offerId: offer.id, quantity },
                      () => `Bought ${offer.item.name} ×${quantity}`,
                    )
                  }
                >
                  {pending === `buy:${offer.id}` ? (
                    "Buying…"
                  ) : (
                    <span className="flex items-center gap-1">
                      Buy for <CoinsIcon size={16} /> {formatGold(total)}
                    </span>
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
