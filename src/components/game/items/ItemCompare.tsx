"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp } from "lucide-react";
import { EquipmentSlotIcon } from "~/components/game/character/Equipment/EquipmentSlotIcon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useOptionalEquipmentContext } from "~/context/equipmentContext";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { cn } from "~/lib/utils";
import type { EquipmentSlotsWithItems } from "~/types/inventory";
import { StatType, type ItemWithStats } from "~/types/stats";
import {
  compareItemStats,
  countChanges,
  getCompareSlots,
  getReplacedItems,
  SLOT_LABELS,
  type StatComparisonRow,
} from "~/utils/itemCompare";
import type { EquipmentSlotKey } from "~/utils/itemEquipTo";
import { rarityStyle } from "~/utils/rarity-colors";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";
import {
  ItemDetailsHeader,
  ItemLevelRequirement,
  type ItemDetailsData,
} from "./ItemDetails";

type CompareItemData = Pick<
  ItemDetailsData,
  | "name"
  | "sprite"
  | "rarity"
  | "price"
  | "itemType"
  | "equipTo"
  | "twoHanded"
  | "requiredLevel"
  | "stats"
>;

const DAMAGE_ROWS = new Set<StatType>([
  StatType.PHYSICAL_DAMAGE_MIN,
  StatType.MAGIC_DAMAGE_MIN,
]);

/**
 * Opens a side-by-side comparison of an equipable item with what the player
 * wears in its slot. Renders nothing for items that can't be equipped, or for
 * the very item the player is wearing.
 */
export function ItemCompareButton({
  item,
  instanceId,
  onEquip,
  equipBlockedReason,
  className,
}: {
  item: CompareItemData;
  /** The owned instance's id, so a worn item doesn't compare with itself. */
  instanceId?: number;
  /** Offers Equip in the comparison, into the slot being compared. */
  onEquip?: (slot: EquipmentSlotKey) => void;
  /** Why Equip is unavailable right now; shown beside the disabled button. */
  equipBlockedReason?: string | null;
  className?: string;
}) {
  const equipment = useOptionalEquipmentContext()?.equipment;
  const [open, setOpen] = useState(false);

  if (!equipment || !item.equipTo) return null;
  if (
    instanceId !== undefined &&
    Object.values(equipment).some((worn) => worn?.id === instanceId)
  ) {
    return null;
  }
  const compareSlots = getCompareSlots(item, equipment);
  if (!compareSlots) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-8 px-2 text-xs bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary",
            className,
          )}
          title="Compare with your equipped item"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
          Compare
        </Button>
      </DialogTrigger>
      {open ? (
        <CompareDialogContent
          item={item}
          equipment={equipment}
          slots={compareSlots.slots}
          initialSlot={compareSlots.initial}
          onEquip={
            onEquip
              ? (slot) => {
                  setOpen(false);
                  onEquip(slot);
                }
              : undefined
          }
          equipBlockedReason={equipBlockedReason}
        />
      ) : null}
    </Dialog>
  );
}

function CompareDialogContent({
  item,
  equipment,
  slots,
  initialSlot,
  onEquip,
  equipBlockedReason,
}: {
  item: CompareItemData;
  equipment: EquipmentSlotsWithItems;
  slots: EquipmentSlotKey[];
  initialSlot: EquipmentSlotKey;
  onEquip?: (slot: EquipmentSlotKey) => void;
  equipBlockedReason?: string | null;
}) {
  const [slot, setSlot] = useState(initialSlot);
  const contentRef = useRef<HTMLDivElement>(null);
  const { current, displaced } = getReplacedItems(item, slot, equipment);
  const rows = compareItemStats(item.stats, [
    ...(current?.stats ?? []),
    ...(displaced?.item.stats ?? []),
  ]);
  const { better, worse } = countChanges(rows);

  // With the slot empty, the other hand's item is the one that comes off.
  const worn = current ?? displaced?.item ?? null;
  const wornSlot = current ? slot : displaced?.slot ?? slot;
  const alsoRemoved = current ? displaced : null;

  return (
    <DialogContent
      ref={contentRef}
      // Open on the comparison itself, not a ringed close button.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        contentRef.current?.focus({ preventScroll: true });
      }}
      className="flex max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 outline-none"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3 pr-14 pt-4">
        <DialogTitle className="pr-0 text-base">Compare</DialogTitle>
        <DialogDescription className="sr-only">
          {item.name} next to your {SLOT_LABELS[slot].toLowerCase()}{" "}
          equipment: {better} stats better, {worse} worse.
        </DialogDescription>
        {slots.length > 1 ? (
          <SlotPicker
            slots={slots}
            selected={slot}
            equipment={equipment}
            onSelect={setSlot}
          />
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="grid gap-3 md:grid-cols-2 md:grid-rows-[auto_auto_auto_1fr] md:gap-y-0">
          <CompareCard
            eyebrow="This item"
            item={item}
            rows={rows}
            side="item"
          />
          {worn ? (
            <CompareCard
              eyebrow={`Equipped · ${SLOT_LABELS[wornSlot]}`}
              item={worn}
              rows={rows}
              side="equipped"
              extra={
                alsoRemoved ? (
                  <AlsoRemoved
                    item={alsoRemoved.item}
                    slot={alsoRemoved.slot}
                  />
                ) : null
              }
            />
          ) : (
            <EmptySlotCard slot={slot} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-inset/50 px-5 py-3">
        <ChangeSummary better={better} worse={worse} />
        {onEquip ? (
          <div className="ml-auto flex items-center gap-3">
            {equipBlockedReason ? (
              <span className="text-xs text-muted-foreground">
                {equipBlockedReason}
              </span>
            ) : null}
            <Button
              disabled={Boolean(equipBlockedReason)}
              onClick={() => onEquip(slot)}
            >
              {slots.length > 1 ? `Equip · ${SLOT_LABELS[slot]}` : "Equip"}
            </Button>
          </div>
        ) : null}
      </div>
    </DialogContent>
  );
}

function SlotPicker({
  slots,
  selected,
  equipment,
  onSelect,
}: {
  slots: EquipmentSlotKey[];
  selected: EquipmentSlotKey;
  equipment: EquipmentSlotsWithItems;
  onSelect: (slot: EquipmentSlotKey) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-[10px] bg-surface-inset/70 p-1"
      role="group"
      aria-label="Compare with slot"
    >
      {slots.map((slot) => {
        const worn = equipment[slot];
        const active = slot === selected;
        return (
          <button
            key={slot}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(slot)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-surface-inset hover:text-foreground",
            )}
          >
            {worn ? (
              <Image
                src={worn.sprite}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] object-contain"
              />
            ) : (
              <span
                className="h-[18px] w-[18px] rounded-[5px] bg-surface-inset"
                aria-hidden="true"
              />
            )}
            {SLOT_LABELS[slot]}
            {worn ? null : <span className="sr-only">(empty)</span>}
          </button>
        );
      })}
    </div>
  );
}

/** One side of the comparison, laid out like the item card. */
function CompareCard({
  eyebrow,
  item,
  rows,
  side,
  extra,
}: {
  eyebrow: string;
  item: Pick<
    CompareItemData,
    | "name"
    | "sprite"
    | "rarity"
    | "price"
    | "itemType"
    | "equipTo"
    | "twoHanded"
    | "requiredLevel"
  >;
  rows: StatComparisonRow[];
  side: "item" | "equipped";
  extra?: ReactNode;
}) {
  const { colors } = useRarityColors();

  return (
    <section
      aria-label={`${eyebrow}: ${item.name}`}
      data-rarity={item.rarity}
      style={rarityStyle(item.rarity, colors[item.rarity])}
      className="flex min-w-0 flex-col rounded-2xl bg-surface-inset/35 bg-[image:linear-gradient(150deg,color-mix(in_srgb,var(--rarity-color)_13%,transparent),transparent_170px)] p-4 md:row-span-4 md:grid md:grid-rows-subgrid"
    >
      <CardEyebrow>{eyebrow}</CardEyebrow>
      <ItemDetailsHeader item={item} />
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <ItemLevelRequirement item={item} className="mb-0" />
          {item.twoHanded ? (
            <span className="text-muted-foreground">· Two-handed</span>
          ) : null}
        </div>
        {extra}
      </div>
      <StatRows rows={rows} side={side} />
    </section>
  );
}

function CardEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Both cards list the same rows in the same order, so each stat lines up
 * across them. The item's side carries the change equipping would make.
 */
function StatRows({
  rows,
  side,
}: {
  rows: StatComparisonRow[];
  side: "item" | "equipped";
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No stats</p>;
  }

  return (
    <ul className="space-y-1 md:self-start">
      {rows.map((row) => {
        const value = side === "item" ? row.item : row.equipped;
        const marked = side === "item" && row.direction !== "same";
        const up = row.direction === "up";
        return (
          <li
            key={row.key}
            className={cn(
              "flex h-8 items-center justify-between gap-2 rounded-md px-2 text-sm",
              marked && (up ? "bg-success/[0.08]" : "bg-danger/[0.08]"),
            )}
          >
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  value === null
                    ? "text-muted-foreground/60"
                    : marked
                      ? up
                        ? "text-success"
                        : "text-danger"
                      : "text-foreground",
                )}
              >
                {value ?? "—"}
              </span>
              {marked && row.change ? (
                <ChangePill
                  change={row.change}
                  up={up}
                  title={
                    DAMAGE_ROWS.has(row.key) ? "Average hit" : undefined
                  }
                />
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ChangePill({
  change,
  up,
  title,
}: {
  change: string;
  up: boolean;
  title?: string;
}) {
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[5px] px-1 py-px text-[10px] font-semibold leading-4 tabular-nums",
        up ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
      )}
    >
      <Arrow size={10} strokeWidth={2.5} aria-hidden="true" />
      {change}
      <span className="sr-only">{up ? " better" : " worse"}</span>
    </span>
  );
}

/** A two-handed swap also frees the other hand; its stats count on this side. */
function AlsoRemoved({
  item,
  slot,
}: {
  item: ItemWithStats;
  slot: EquipmentSlotKey;
}) {
  const { colors } = useRarityColors();
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-inset/70 p-1.5 pr-2.5 text-xs">
      <span
        className="rarity-frame relative h-8 w-8 shrink-0 rounded-md p-0.5"
        data-rarity={item.rarity}
        style={rarityStyle(item.rarity, colors[item.rarity])}
      >
        <Image
          src={item.sprite}
          alt=""
          width={32}
          height={32}
          className="h-full w-full object-contain"
        />
        <ItemRarityMark rarity={item.rarity} />
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">+ {SLOT_LABELS[slot]} </span>
        <span
          className="font-semibold"
          style={{ color: "var(--rarity-text, var(--rarity-color))" }}
        >
          {item.name}
        </span>
      </span>
    </div>
  );
}

function EmptySlotCard({ slot }: { slot: EquipmentSlotKey }) {
  return (
    <section
      aria-label={`${SLOT_LABELS[slot]}: nothing equipped`}
      className="flex min-w-0 flex-col rounded-2xl bg-surface-inset/35 p-4 md:row-span-4 md:grid md:grid-rows-subgrid"
    >
      <CardEyebrow>Equipped · {SLOT_LABELS[slot]}</CardEyebrow>
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center md:row-span-3">
        <span className="flex h-20 w-20 items-center justify-center rounded-[14px] bg-surface-inset/80 [&_svg]:h-9 [&_svg]:w-9">
          <EquipmentSlotIcon slot={slot} />
        </span>
        <p className="text-sm font-semibold text-muted-foreground">
          Nothing equipped
        </p>
      </div>
    </section>
  );
}

function ChangeSummary({ better, worse }: { better: number; worse: number }) {
  if (better === 0 && worse === 0) {
    return <span className="text-xs text-muted-foreground">Same stats</span>;
  }
  return (
    <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
      {better > 0 ? (
        <span className="inline-flex h-6 items-center gap-1 rounded-[7px] bg-success/15 px-2 text-success">
          <ArrowUp className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {better} better
        </span>
      ) : null}
      {worse > 0 ? (
        <span className="inline-flex h-6 items-center gap-1 rounded-[7px] bg-danger/15 px-2 text-danger">
          <ArrowDown className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {worse} worse
        </span>
      ) : null}
    </div>
  );
}
