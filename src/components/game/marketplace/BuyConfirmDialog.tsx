"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { ArrowDownToLine, ShoppingCart } from "lucide-react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { useUserGold } from "~/hooks/use-user-gold";
import type {
  MarketplaceGroupedItem,
  MarketplaceListing,
} from "~/types/marketplace";
import { rarityStyle } from "~/utils/rarity-colors";
import { RarityBadge } from "~/utils/ui/rarity-badge";

const formatGold = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** Quantity input with 1 / 10 / 100 / All presets, clamped to 1…max. */
export function QuantityField({
  value,
  max,
  allowAll,
  onChange,
}: {
  value: number;
  max: number;
  allowAll: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          Quantity
        </label>
        <div className="flex gap-1">
          {[1, 10, 100].map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant="secondary"
              className="h-7 px-2.5"
              onClick={() => onChange(Math.min(preset, max))}
              disabled={preset > max}
            >
              {preset}
            </Button>
          ))}
          {allowAll && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2.5"
              onClick={() => onChange(max)}
            >
              All
            </Button>
          )}
        </div>
      </div>
      <Input
        id={id}
        type="number"
        min={1}
        max={max}
        value={value}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          onChange(
            Math.min(max, Math.max(1, Number.isFinite(next) ? next : 1)),
          );
        }}
        className="border-0 shadow-none"
      />
    </div>
  );
}

export function BuyConfirmDialog({
  open,
  onOpenChange,
  market,
  listing,
  quantity,
  maxQuantity,
  onQuantityChange,
  unitPrice,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: MarketplaceGroupedItem;
  /** The offer being bought; null confirms a buy order at `unitPrice`. */
  listing: MarketplaceListing | null;
  quantity: number;
  maxQuantity: number;
  onQuantityChange: (quantity: number) => void;
  unitPrice: number;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const { colors } = useRarityColors();
  const { data: gold } = useUserGold();
  const isOrder = listing === null;
  const total = unitPrice * quantity;
  const shortfall = gold === undefined ? 0 : total - gold;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden border-0 p-0 sm:max-w-[380px]">
        <div
          className="game-market-detail-header flex items-center gap-4 p-5 pr-12"
          style={rarityStyle(market.rarity, colors[market.rarity])}
        >
          <ItemArtwork
            src={market.sprite}
            name={market.itemName}
            rarity={market.rarity}
            size={64}
            quantity={quantity > 1 ? `×${quantity}` : undefined}
          />
          <div className="min-w-0 space-y-1">
            <p className="game-eyebrow">
              {isOrder ? "Confirm buy order" : "Confirm purchase"}
            </p>
            <DialogTitle className="truncate pr-0 text-lg">
              {market.itemName}
            </DialogTitle>
            <RarityBadge
              rarity={market.rarity}
              className="border-0 px-1.5 py-0.5 text-[11px]"
            />
          </div>
        </div>
        <DialogDescription className="sr-only">
          {isOrder
            ? `Reserve ${formatGold(total)} gold for a buy order of ${quantity} ${market.itemName}.`
            : `Buy ${quantity} ${market.itemName} for ${formatGold(total)} gold.`}
        </DialogDescription>

        <div className="space-y-4 bg-background/40 px-5 py-4 text-sm">
          <dl className="space-y-2">
            {listing && (
              <Row label="Seller">{listing.user.name ?? "Wayfarer"}</Row>
            )}
            <Row label={isOrder ? "Your bid" : "Price each"}>
              <CoinsIcon size={14} /> {formatGold(unitPrice)}
            </Row>
            {listing && listing.stats.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {listing.stats.map((stat) => (
                  <span
                    key={stat.statType}
                    className="rounded bg-surface-inset px-1.5 py-1 text-[10px]"
                  >
                    {stat.statType.replaceAll("_", " ")}{" "}
                    {stat.value > 0 ? "+" : ""}
                    {stat.value}
                  </span>
                ))}
              </div>
            )}
          </dl>
          <QuantityField
            value={quantity}
            max={maxQuantity}
            allowAll={!isOrder}
            onChange={onQuantityChange}
          />
        </div>

        <div className="space-y-1 px-5 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">
              {isOrder ? "Gold reserved" : "Total"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xl font-semibold tabular-nums text-currency">
              <CoinsIcon size={18} /> {formatGold(total)}
            </span>
          </div>
          {gold !== undefined &&
            (shortfall > 0 ? (
              <p className="text-right text-xs text-danger">
                You need {formatGold(shortfall)} more gold
              </p>
            ) : (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Gold after</span>
                <span className="tabular-nums">{formatGold(gold - total)}</span>
              </div>
            ))}
          {isOrder && (
            <p className="text-xs text-muted-foreground">
              Held until the order fills or you cancel it.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 p-5">
          <DialogClose asChild>
            <Button variant="secondary" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={isPending || shortfall > 0}>
            {isOrder ? (
              <ArrowDownToLine className="h-4 w-4" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {isPending ? "Working…" : isOrder ? "Place order" : "Buy now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
