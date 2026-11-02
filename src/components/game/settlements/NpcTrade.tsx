"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Backpack, Minus, Plus, ScrollText } from "lucide-react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import type { ItemRarity } from "~/generated/prisma/enums";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { formatGold, roundGold } from "~/lib/marketplace";
import { cn } from "~/lib/utils";
import { resolveRarityColor } from "~/utils/rarity-colors";
import { useSettlementAction } from "./useSettlementAction";

type Offer = {
  id: number;
  price: number;
  item: { id: number; name: string; sprite: string; rarity: ItemRarity };
};

type SellableStack = {
  userItemId: number;
  rarity: ItemRarity;
  quantity: number;
  /** What this NPC pays for one: the item's value. */
  price: number;
  item: { id: number; name: string; sprite: string };
};

/** An item one of this NPC's accepted quests asks to be delivered. */
export type QuestNeed = { itemId: number; quantity: number; quest: string };

type Tab = "buy" | "sell";

const MAX_QUANTITY = 999;

export function NpcTrade(props: {
  npcId: number;
  npcName: string;
  gold: number;
  offers: Offer[];
  inventory: SellableStack[];
  needs: QuestNeed[];
}) {
  const tabs: Tab[] = props.offers.length > 0 ? ["buy", "sell"] : ["sell"];
  const [tab, setTab] = useState<Tab>(tabs[0]!);

  const held = useMemo(() => {
    const counts = new Map<number, number>();
    for (const stack of props.inventory) {
      counts.set(
        stack.item.id,
        (counts.get(stack.item.id) ?? 0) + stack.quantity,
      );
    }
    return counts;
  }, [props.inventory]);
  const needs = useMemo(() => {
    const byItem = new Map<number, { quantity: number; quests: string[] }>();
    for (const need of props.needs) {
      const entry = byItem.get(need.itemId) ?? { quantity: 0, quests: [] };
      entry.quantity += need.quantity;
      entry.quests.push(need.quest);
      byItem.set(need.itemId, entry);
    }
    return byItem;
  }, [props.needs]);

  return (
    <section id="wares" className="game-panel-flat scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div
          role="tablist"
          aria-label={`Trade with ${props.npcName}`}
          className="inline-flex rounded-[10px] bg-surface-inset/70 p-1"
        >
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`trade-tab-${value}`}
              aria-controls={`trade-panel-${value}`}
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-[8px] px-4 text-sm font-semibold transition-colors",
                tab === value
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "buy" ? "Buy" : "Sell"}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  tab === value
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary/60",
                )}
              >
                {value === "buy" ? props.offers.length : props.inventory.length}
              </span>
            </button>
          ))}
        </div>
        <Purse gold={props.gold} />
      </div>

      <div
        role="tabpanel"
        id={`trade-panel-${tab}`}
        aria-labelledby={`trade-tab-${tab}`}
        className="p-4 sm:p-6"
      >
        {tab === "buy" ? (
          <Shelf
            offers={props.offers}
            gold={props.gold}
            held={held}
            needs={needs}
          />
        ) : (
          <Pack
            npcId={props.npcId}
            npcName={props.npcName}
            gold={props.gold}
            inventory={props.inventory}
            held={held}
            needs={needs}
          />
        )}
      </div>
    </section>
  );
}

type Needs = Map<number, { quantity: number; quests: string[] }>;

/** The player's gold, with the last change floating over it for a moment. */
function Purse({ gold }: { gold: number }) {
  const previous = useRef(gold);
  const [change, setChange] = useState<{ amount: number; key: number } | null>(
    null,
  );
  useEffect(() => {
    const amount = roundGold(gold - previous.current);
    previous.current = gold;
    if (amount === 0) return;
    setChange({ amount, key: Date.now() });
    const timer = setTimeout(() => setChange(null), 2000);
    return () => clearTimeout(timer);
  }, [gold]);

  return (
    <div
      className="relative flex items-center gap-1.5 rounded-full bg-currency/10 py-1 pl-1.5 pr-3"
      title="Your gold"
    >
      <CoinsIcon size={20} />
      <span className="text-sm font-semibold tabular-nums text-currency">
        {formatGold(gold)}
      </span>
      {change ? (
        <span
          key={change.key}
          aria-live="polite"
          className={cn(
            "absolute -top-5 right-2 text-xs font-semibold tabular-nums animate-in fade-in slide-in-from-bottom-2",
            change.amount > 0 ? "text-success" : "text-danger",
          )}
        >
          {change.amount > 0 ? "+" : "−"}
          {formatGold(Math.abs(change.amount))}
        </span>
      ) : null}
    </div>
  );
}

function Shelf(props: {
  offers: Offer[];
  gold: number;
  held: Map<number, number>;
  needs: Needs;
}) {
  const { run, pending } = useSettlementAction();
  const { colors } = useRarityColors();
  const [selectedId, setSelectedId] = useState(props.offers[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const selected =
    props.offers.find((offer) => offer.id === selectedId) ?? props.offers[0];
  if (!selected) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing for sale right now.
      </p>
    );
  }

  const affordable = (price: number) =>
    price <= 0 ? MAX_QUANTITY : Math.floor(props.gold / price);
  const max = Math.max(1, Math.min(MAX_QUANTITY, affordable(selected.price)));
  // Spending gold can lower what is affordable, so never offer more than that.
  const amount = Math.min(quantity, max);
  const total = roundGold(selected.price * amount);
  const owned = props.held.get(selected.item.id) ?? 0;
  const need = props.needs.get(selected.item.id);
  const missing = need ? need.quantity - owned : 0;

  return (
    <div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(146px,1fr))] gap-2.5">
        {props.offers.map((offer) => {
          const isSelected = offer.id === selected.id;
          const have = props.held.get(offer.item.id) ?? 0;
          const wanted = props.needs.get(offer.item.id);
          const short = wanted ? wanted.quantity - have : 0;
          const canAfford = offer.price <= props.gold;
          return (
            <li key={offer.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${offer.item.name}, ${formatGold(offer.price)} gold`}
                onClick={() => {
                  setSelectedId(offer.id);
                  setQuantity(1);
                }}
                className={cn(
                  "relative flex h-full w-full flex-col items-center gap-2 overflow-hidden rounded-lg px-3 pb-3 pt-5 text-center transition-colors",
                  isSelected
                    ? "bg-primary/10 bg-[radial-gradient(ellipse_at_50%_110%,hsl(var(--primary)/0.28),transparent_70%)]"
                    : "bg-secondary/25 hover:bg-secondary/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-4 h-16 w-24 -translate-x-1/2 rounded-full opacity-25 blur-2xl"
                  style={{
                    background: resolveRarityColor(
                      offer.item.rarity,
                      colors[offer.item.rarity],
                    ),
                  }}
                />
                <ItemArtwork
                  src={offer.item.sprite}
                  name={offer.item.name}
                  rarity={offer.item.rarity}
                  size={64}
                />
                <span
                  className={cn(
                    "line-clamp-2 min-h-10 text-sm font-medium leading-5",
                    isSelected && "text-primary",
                  )}
                >
                  {offer.item.name}
                </span>
                <span
                  className={cn(
                    "mt-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums",
                    canAfford
                      ? "bg-currency/10 text-currency"
                      : "bg-danger/10 text-danger",
                  )}
                >
                  <CoinsIcon size={14} />
                  {formatGold(offer.price)}
                </span>
                {short > 0 ? (
                  <Tag
                    className="left-2 bg-primary/20 text-primary"
                    title={`${wanted!.quests.join(", ")}: ${short} more needed`}
                  >
                    <ScrollText className="h-3 w-3" aria-hidden="true" />
                    {short}
                  </Tag>
                ) : null}
                {have > 0 ? (
                  <Tag className="right-2" title={`${have} in your inventory`}>
                    <Backpack className="h-3 w-3" aria-hidden="true" />
                    {have}
                  </Tag>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <Counter
        artwork={
          <ItemArtwork
            src={selected.item.sprite}
            name={selected.item.name}
            rarity={selected.item.rarity}
            size={52}
            itemId={selected.item.id}
          />
        }
        name={selected.item.name}
        details={
          <>
            <CoinsIcon size={13} />
            {formatGold(selected.price)} each
            {owned > 0 ? <> · You own {owned}</> : null}
          </>
        }
        note={
          need && missing > 0 ? (
            <span className="text-primary">
              {need.quests.join(", ")} needs {missing} more
            </span>
          ) : null
        }
        quantity={amount}
        max={max}
        maxLabel="Max"
        onQuantity={setQuantity}
        quantityLabel={`Quantity of ${selected.item.name}`}
        total={total}
        after={roundGold(props.gold - total)}
        action={
          <Button
            className="min-w-[96px]"
            disabled={pending !== null || total > props.gold}
            onClick={() =>
              void run(
                `buy:${selected.id}`,
                "/api/settlements/buy",
                { offerId: selected.id, quantity: amount },
                () => `Bought ${selected.item.name} ×${amount}`,
              )
            }
          >
            {pending === `buy:${selected.id}` ? "Buying…" : "Buy"}
          </Button>
        }
      />
    </div>
  );
}

function Pack(props: {
  npcId: number;
  npcName: string;
  gold: number;
  inventory: SellableStack[];
  held: Map<number, number>;
  needs: Needs;
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

  const worth = roundGold(
    props.inventory.reduce(
      (sum, stack) => sum + stack.price * stack.quantity,
      0,
    ),
  );
  // Selling part of a stack refreshes it smaller, so never offer more than is left.
  const amount = selected
    ? Math.min(Math.max(1, quantity), selected.quantity)
    : 1;
  const total = selected ? roundGold(selected.price * amount) : 0;
  const need = selected ? props.needs.get(selected.item.id) : undefined;
  const left = selected ? (props.held.get(selected.item.id) ?? 0) - amount : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-currency/10 px-3 py-1 font-medium text-text-secondary">
          Inventory value
          <CoinsIcon size={14} />
          <strong className="tabular-nums text-currency">
            {formatGold(worth)}
          </strong>
        </span>
        <span className="rounded-full bg-secondary/40 px-3 py-1 text-muted-foreground">
          {props.npcName} pays each item&apos;s value
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {props.inventory.map((stack) => {
          const isSelected = stack.userItemId === selectedId;
          const wanted = props.needs.get(stack.item.id);
          return (
            <button
              key={stack.userItemId}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${stack.item.name}, ${stack.quantity}, worth ${formatGold(stack.price)} gold each`}
              onClick={() => {
                setSelectedId(stack.userItemId);
                setQuantity(stack.quantity);
              }}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors",
                isSelected ? "bg-primary/15" : "hover:bg-secondary/40",
              )}
            >
              <ItemArtwork
                src={stack.item.sprite}
                name={stack.item.name}
                rarity={stack.rarity}
                size={56}
                quantity={stack.quantity > 1 ? stack.quantity : undefined}
              />
              <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-currency">
                <CoinsIcon size={12} />
                {formatGold(stack.price)}
              </span>
              {wanted ? (
                <Tag
                  className="left-0.5 top-0.5 bg-primary/25 text-primary"
                  title={`Needed for ${wanted.quests.join(", ")}`}
                >
                  <ScrollText className="h-3 w-3" aria-hidden="true" />
                </Tag>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <Counter
          artwork={
            <ItemArtwork
              src={selected.item.sprite}
              name={selected.item.name}
              rarity={selected.rarity}
              size={52}
              itemId={selected.item.id}
            />
          }
          name={selected.item.name}
          details={
            <>
              <CoinsIcon size={13} />
              {formatGold(selected.price)} each · You have {selected.quantity}
            </>
          }
          note={
            need && left < need.quantity ? (
              <span className="text-warning">
                Leaves {Math.max(0, left)}/{need.quantity} for{" "}
                {need.quests.join(", ")}
              </span>
            ) : null
          }
          quantity={amount}
          max={selected.quantity}
          maxLabel="All"
          onQuantity={setQuantity}
          quantityLabel={`How many ${selected.item.name} to sell`}
          total={total}
          after={roundGold(props.gold + total)}
          action={
            <Button
              className="min-w-[96px]"
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
              {pending ? "Selling…" : "Sell"}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

/** A small badge pinned to a corner of an item tile. */
function Tag(props: {
  className?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={props.title}
      className={cn(
        "absolute top-2 inline-flex items-center gap-0.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-text-secondary",
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}

/**
 * The trade counter, laid out like a receipt: the chosen item and the total
 * with the gold left afterwards, then how many and the action. It sticks to
 * the bottom of the screen while the shelf scrolls.
 */
function Counter(props: {
  artwork: React.ReactNode;
  name: string;
  details: React.ReactNode;
  note: React.ReactNode;
  quantity: number;
  max: number;
  maxLabel: string;
  onQuantity: (quantity: number) => void;
  quantityLabel: string;
  total: number;
  after: number;
  action: React.ReactNode;
}) {
  const set = (value: number) =>
    props.onQuantity(
      Number.isFinite(value)
        ? Math.min(props.max, Math.max(1, Math.floor(value)))
        : 1,
    );
  const quick =
    "h-9 rounded-[8px] px-2.5 text-xs font-semibold transition-colors";

  return (
    <div className="sticky bottom-3 z-10 mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-lg bg-card/95 p-3 shadow-[var(--shadow-overlay)] backdrop-blur-md sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        {props.artwork}
        <div className="min-w-0">
          <strong className="block truncate text-sm">{props.name}</strong>
          <span className="block text-xs text-muted-foreground [&>img]:mr-1 [&>img]:align-[-2px]">
            {props.details}
          </span>
          {props.note ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs">
              <ScrollText className="h-3 w-3 shrink-0" aria-hidden="true" />
              {props.note}
            </span>
          ) : null}
        </div>
      </div>

      <div className="text-right">
        <span className="flex items-center justify-end gap-1 text-base font-semibold tabular-nums text-currency">
          <CoinsIcon size={18} />
          {formatGold(props.total)}
        </span>
        <span
          className={cn(
            "block text-[11px] tabular-nums",
            props.after < 0 ? "text-danger" : "text-muted-foreground",
          )}
        >
          {props.after < 0
            ? `${formatGold(-props.after)} short`
            : `${formatGold(props.after)} after`}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center rounded-[8px] bg-surface-inset">
          <button
            type="button"
            aria-label="One fewer"
            disabled={props.quantity <= 1}
            onClick={() => set(props.quantity - 1)}
            className="grid h-9 w-8 place-items-center rounded-l-[8px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-label={props.quantityLabel}
            min={1}
            max={props.max}
            value={props.quantity}
            onChange={(event) => set(Number(event.target.value))}
            className="h-9 w-12 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none [appearance:textfield] focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="One more"
            disabled={props.quantity >= props.max}
            onClick={() => set(props.quantity + 1)}
            className="grid h-9 w-8 place-items-center rounded-r-[8px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {props.max >= 20 ? (
          <button
            type="button"
            onClick={() => set(10)}
            className={cn(
              quick,
              props.quantity === 10
                ? "bg-primary/15 text-primary"
                : "bg-secondary/40 text-text-secondary hover:bg-secondary/60",
            )}
          >
            10
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => set(props.max)}
          className={cn(
            quick,
            props.quantity === props.max
              ? "bg-primary/15 text-primary"
              : "bg-secondary/40 text-text-secondary hover:bg-secondary/60",
          )}
        >
          {props.maxLabel}
        </button>
      </div>

      <div className="justify-self-end">{props.action}</div>
    </div>
  );
}
