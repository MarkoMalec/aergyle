"use client";

import React, { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  Field,
  inputClass,
  NumberInput,
  Panel,
} from "~/components/admin/fields";
import { SearchSelect } from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ItemRarity, StatType } from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import type { AdminPlayer } from "~/server/admin/players";
import { STAT_METADATA } from "~/types/stats";
import {
  ActionButton,
  Empty,
  formatGold,
  humanize,
  ItemArt,
  Row,
  Tag,
  usePlayerEdit,
} from "./shared";

type PlayerItem = AdminPlayer["items"][number];

const RARITIES = Object.values(ItemRarity);
const STAT_TYPES = Object.values(StatType);

const PLACES = [
  { value: "ALL", label: "All" },
  { value: "BAG", label: "Bag" },
  { value: "EQUIPPED", label: "Equipped" },
  { value: "STORAGE", label: "Storage" },
  { value: "LISTED", label: "Market" },
  { value: "OTHER", label: "Delete slot / unplaced" },
] as const;
type Place = (typeof PLACES)[number]["value"];

function placeOf(item: PlayerItem): Place {
  const kind = item.placement.kind;
  return kind === "DELETE_SLOT" || kind === "UNPLACED" ? "OTHER" : kind;
}

function placementLabel(item: PlayerItem) {
  const placement = item.placement;
  switch (placement.kind) {
    case "BAG":
      return <Tag>Bag · slot {placement.slotIndex + 1}</Tag>;
    case "EQUIPPED":
      return <Tag tone="info">Equipped · {humanize(placement.slot)}</Tag>;
    case "STORAGE":
      return <Tag>Storage · {item.storageName ?? "?"}</Tag>;
    case "LISTED":
      return (
        <Tag tone="warn">
          Listed · {formatGold(item.listedPrice ?? 0)} gold
        </Tag>
      );
    case "DELETE_SLOT":
      return <Tag tone="bad">Delete slot</Tag>;
    case "UNPLACED":
      return <Tag tone="bad">Unplaced · invisible to them</Tag>;
  }
}

function GiveItems() {
  const { options, run } = usePlayerEdit();
  const [itemId, setItemId] = useState<number | null>(null);
  const [rarity, setRarity] = useState<ItemRarity>("COMMON");
  const [quantity, setQuantity] = useState<number | null>(1);
  const item = options.items.find((option) => option.id === itemId);

  const searchOptions = useMemo(
    () =>
      options.items.map((option) => ({
        id: option.id,
        name: option.name,
        image: option.sprite,
        detail: `#${option.id}`,
      })),
    [options.items],
  );

  return (
    <div className="grid gap-3 rounded-lg bg-black/25 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_120px_auto] md:items-end">
      <Field label="Item">
        <SearchSelect
          options={searchOptions}
          value={itemId}
          placeholder="Choose an item…"
          onChange={(id) => {
            setItemId(id);
            const chosen = options.items.find((option) => option.id === id);
            if (chosen) setRarity(chosen.rarity);
          }}
        />
      </Field>
      <Field label="Rarity">
        <select
          className={inputClass}
          value={rarity}
          onChange={(event) => setRarity(event.target.value as ItemRarity)}
        >
          {RARITIES.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantity">
        <NumberInput
          className={inputClass}
          min={1}
          value={quantity}
          onValueChange={setQuantity}
        />
      </Field>
      <ActionButton
        actionKey="give"
        variant="default"
        className="h-9"
        disabled={!item || !quantity || quantity < 1}
        onClick={() =>
          run(
            "give",
            "/items",
            "POST",
            { itemId, rarity, quantity },
            (result) => {
              const added = Number(result?.added ?? 0);
              const notAdded = Number(result?.notAdded ?? 0);
              return notAdded > 0
                ? `Gave ${added} ${item?.name}; ${notAdded} didn't fit`
                : `Gave ${added} ${item?.name}`;
            },
          )
        }
      >
        <Plus className="h-4 w-4" />
        Give
      </ActionButton>
    </div>
  );
}

function EditItemDialog(props: {
  item: PlayerItem;
  onClose: () => void;
}) {
  const { run, busy } = usePlayerEdit();
  const { item } = props;
  const [quantity, setQuantity] = useState<number | null>(item.quantity);
  const [rarity, setRarity] = useState(item.rarity);
  const [isTradeable, setTradeable] = useState(item.isTradeable);
  const [modifiers, setModifiers] = useState(item.modifiers);
  const maxStack = item.stackable ? Math.max(1, item.maxStackSize) : 1;

  const save = async () => {
    const result = await run(
      `edit-${item.id}`,
      `/items/${item.id}`,
      "PATCH",
      { quantity: quantity ?? item.quantity, rarity, isTradeable, modifiers },
      `${item.name} saved`,
    );
    if (result) props.onClose();
  };

  const unusedStat = STAT_TYPES.find(
    (statType) => !modifiers.some((row) => row.statType === statType),
  );

  return (
    <Dialog open onOpenChange={(open) => (open ? null : props.onClose())}>
      <DialogContent className="admin-theme dark max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <ItemArt sprite={item.sprite} rarity={rarity} />
            {item.name}
            <span className="text-xs font-normal text-white/40">
              #{item.id}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Quantity"
            hint={item.stackable ? `Stacks to ${maxStack}` : "Doesn't stack"}
          >
            <NumberInput
              className={inputClass}
              min={1}
              max={maxStack}
              disabled={!item.stackable}
              value={quantity}
              onValueChange={setQuantity}
            />
          </Field>
          <Field label="Rarity">
            <select
              className={inputClass}
              value={rarity}
              onChange={(event) => setRarity(event.target.value as ItemRarity)}
            >
              {RARITIES.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trading">
            <select
              className={inputClass}
              value={isTradeable ? "yes" : "no"}
              onChange={(event) => setTradeable(event.target.value === "yes")}
            >
              <option value="yes">Tradeable</option>
              <option value="no">Bound</option>
            </select>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-white/70">
            Extra stats on this item
            <span className="block text-[11px] font-normal text-white/40">
              Added on top of what the item and its rarity give.
            </span>
          </div>
          {modifiers.map((row, index) => (
            <div key={index} className="flex gap-2">
              <select
                className={inputClass}
                value={row.statType}
                onChange={(event) =>
                  setModifiers((rows) =>
                    rows.map((entry, at) =>
                      at === index
                        ? { ...entry, statType: event.target.value as StatType }
                        : entry,
                    ),
                  )
                }
              >
                {STAT_TYPES.map((statType) => (
                  <option
                    key={statType}
                    value={statType}
                    disabled={
                      statType !== row.statType &&
                      modifiers.some((entry) => entry.statType === statType)
                    }
                  >
                    {STAT_METADATA[statType].label}
                  </option>
                ))}
              </select>
              <NumberInput
                className={cn(inputClass, "w-32")}
                step={0.1}
                value={row.value}
                onValueChange={(value) =>
                  setModifiers((rows) =>
                    rows.map((entry, at) =>
                      at === index ? { ...entry, value: value ?? 0 } : entry,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Remove stat"
                onClick={() =>
                  setModifiers((rows) => rows.filter((_, at) => at !== index))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {unusedStat ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setModifiers((rows) => [
                  ...rows,
                  { statType: unusedStat, value: 0 },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add stat
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy !== null}
            onClick={() => void save()}
          >
            {busy === `edit-${item.id}` ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ItemActions({ item }: { item: PlayerItem }) {
  const { run } = usePlayerEdit();
  return (
    <>
      {item.placement.kind !== "BAG" ? (
        <ActionButton
          actionKey={`move-${item.id}`}
          confirm={
            item.placement.kind === "LISTED"
              ? "Take this off the market and put it in their bag?"
              : undefined
          }
          onClick={() =>
            run(`move-${item.id}`, `/items/${item.id}`, "POST", undefined, `${item.name} moved to their bag`)
          }
        >
          To bag
        </ActionButton>
      ) : null}
      <ActionButton
        actionKey={`delete-${item.id}`}
        variant="ghost"
        confirm={`Delete ${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.name}? It's gone for good.`}
        onClick={() =>
          run(`delete-${item.id}`, `/items/${item.id}`, "DELETE", undefined, `${item.name} deleted`)
        }
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete</span>
      </ActionButton>
    </>
  );
}

export function ItemsTab() {
  const { player } = usePlayerEdit();
  const [place, setPlace] = useState<Place>("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PlayerItem | null>(null);

  const counts = useMemo(() => {
    const byPlace = new Map<Place, number>([["ALL", player.items.length]]);
    for (const item of player.items) {
      byPlace.set(placeOf(item), (byPlace.get(placeOf(item)) ?? 0) + 1);
    }
    return byPlace;
  }, [player.items]);

  const shown = player.items.filter((item) => {
    if (place !== "ALL" && placeOf(item) !== place) return false;
    const search = query.trim().toLowerCase();
    return (
      !search ||
      item.name.toLowerCase().includes(search) ||
      String(item.id) === search.replace(/^#/, "")
    );
  });

  return (
    <div className="space-y-6">
      <Panel
        title="Give items"
        description={`Goes into their bag, filling matching stacks first; only what fits is given. Bag: ${player.bag.used} of ${player.bag.slots} slots used (their stats allow ${player.bag.capacity}).`}
      >
        <GiveItems />
      </Panel>

      <Panel
        title="Everything they own"
        description="Every stack in their bag, equipment, storages and market listings. Sold and destroyed items aren't shown."
      >
        <div className="flex flex-wrap items-center gap-2">
          {PLACES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPlace(option.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                place === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-white/70 hover:bg-white/10",
              )}
            >
              {option.label}{" "}
              <span className="tabular-nums opacity-70">
                {counts.get(option.value) ?? 0}
              </span>
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              className={cn(inputClass, "pl-8")}
              placeholder="Search name or #id"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <div className="space-y-2">
            {shown.map((item) => (
              <Row key={item.id} className="py-2">
                <ItemArt
                  sprite={item.sprite}
                  rarity={item.rarity}
                  quantity={item.quantity}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {item.name}
                    <span className="text-xs font-normal text-white/40">
                      {humanize(item.rarity)} · #{item.id}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {placementLabel(item)}
                    {!item.isTradeable ? <Tag tone="warn">Bound</Tag> : null}
                    {item.modifiers.map((row) => (
                      <Tag key={row.statType} tone="good">
                        {row.value > 0 ? "+" : ""}
                        {row.value} {STAT_METADATA[row.statType].shortLabel ?? STAT_METADATA[row.statType].label}
                      </Tag>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing(item)}
                >
                  Edit
                </Button>
                <ItemActions item={item} />
              </Row>
            ))}
          </div>
        )}
      </Panel>

      {editing ? (
        <EditItemDialog
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
