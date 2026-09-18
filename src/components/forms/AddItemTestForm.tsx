"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  LoaderCircle,
  Minus,
  PackagePlus,
  Plus,
  RotateCcw,
  SearchX,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ItemRarity } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import { rarityStyle } from "~/utils/rarity-colors";
import { RarityMark } from "~/utils/ui/rarity-mark";

interface CatalogItem {
  id: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  itemType: string | null;
  equipTo: string | null;
  stackable: boolean;
  maxStackSize: number;
  requiredLevel: number | null;
}

interface AddItemTestFormProps {
  items: CatalogItem[];
}

type ResultMessage = {
  tone: "success" | "warning" | "error";
  text: string;
};

const RARITIES: ItemRarity[] = [
  "WORTHLESS",
  "BROKEN",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EXQUISITE",
  "EPIC",
  "ELITE",
  "UNIQUE",
  "LEGENDARY",
  "MYTHIC",
  "DIVINE",
];

const QUANTITY_PRESETS = [1, 5, 10, 25];

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AddItemTestForm({ items }: AddItemTestFormProps) {
  const queryClient = useQueryClient();
  const { colors } = useRarityColors();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<ItemRarity>("COMMON");
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultMessage | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );
  const usesTemplateRarity = selectedItem?.rarity === selectedRarity;

  const updateQuantity = (nextQuantity: number) => {
    if (!Number.isFinite(nextQuantity)) return;
    setQuantity(Math.max(1, Math.floor(nextQuantity)));
  };

  const selectItem = (item: CatalogItem) => {
    setSelectedItemId(item.id);
    setSelectedRarity(item.rarity);
    setResult(null);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/test/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          rarity: selectedRarity,
          quantity,
        }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      const payload =
        typeof responseBody === "object" && responseBody !== null
          ? (responseBody as Record<string, unknown>)
          : {};

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Failed to add item",
        );
      }

      const addedQuantity =
        typeof payload.addedQuantity === "number" ? payload.addedQuantity : 1;
      const remainingQuantity =
        typeof payload.remainingQuantity === "number"
          ? payload.remainingQuantity
          : 0;
      const itemName =
        typeof payload.itemName === "string"
          ? payload.itemName
          : selectedItem.name;
      const rarity = humanize(
        typeof payload.rarity === "string" ? payload.rarity : selectedRarity,
      );

      let nextResult: ResultMessage;
      if (addedQuantity === 0) {
        nextResult = {
          tone: "warning",
          text: `No ${itemName} added — the inventory has no room.`,
        };
      } else if (remainingQuantity > 0) {
        nextResult = {
          tone: "warning",
          text: `Added ${addedQuantity.toLocaleString()} × ${itemName} (${rarity}); ${remainingQuantity.toLocaleString()} could not fit.`,
        };
      } else {
        nextResult = {
          tone: "success",
          text: `Added ${addedQuantity.toLocaleString()} × ${itemName} (${rarity}) to the inventory.`,
        };
      }

      setResult(nextResult);
      setQuantity(1);
      if (nextResult.tone === "success") {
        toast.success(nextResult.text);
      } else {
        toast(nextResult.text);
      }

      await queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.all(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add item";
      setResult({ tone: "error", text: message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-[460px] lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section
        className="min-w-0 border-b border-border lg:border-b-0 lg:border-r"
        aria-labelledby="development-catalog-heading"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3
              id="development-catalog-heading"
              className="font-display text-base font-semibold"
            >
              Item catalog
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Search by name, ID, type, slot, or rarity
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-border bg-surface-inset px-2 py-1 text-xs tabular-nums text-muted-foreground">
            {items.length.toLocaleString()} items
          </span>
        </div>

        <Command className="rounded-none bg-transparent">
          <CommandInput
            placeholder="Search the item catalog…"
            aria-label="Search the item catalog"
            className="h-11"
          />
          <CommandList className="max-h-[420px] min-h-[360px] p-2">
            <CommandEmpty className="grid min-h-[260px] place-items-center px-6 py-10 text-center">
              <span>
                <SearchX
                  className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60"
                  aria-hidden="true"
                />
                <span className="block font-medium">No matching items</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Try a name, database ID, item type, equipment slot, or rarity.
                </span>
              </span>
            </CommandEmpty>
            <CommandGroup className="p-0">
              {items.map((item) => {
                const isSelected = item.id === selectedItemId;
                const typeLabel = item.itemType
                  ? humanize(item.itemType)
                  : item.equipTo
                    ? humanize(item.equipTo)
                    : "Uncategorized";

                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} #${item.id} ${item.itemType ?? ""} ${item.equipTo ?? ""} ${item.rarity} ${item.stackable ? "stackable" : "equipment"}`}
                    onSelect={() => selectItem(item)}
                    aria-pressed={isSelected}
                    className={cn(
                      "mb-1 min-h-[64px] cursor-pointer rounded-lg border border-transparent px-2.5 py-2 transition-colors last:mb-0",
                      isSelected &&
                        "border-primary/35 bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]",
                    )}
                  >
                    <div
                      className="rarity-frame relative grid h-11 w-11 shrink-0 place-items-center rounded-lg p-1"
                      data-rarity={item.rarity}
                      style={rarityStyle(item.rarity, colors[item.rarity])}
                    >
                      <Image
                        src={item.sprite}
                        alt=""
                        width={44}
                        height={44}
                        className="h-full w-full rounded-md object-contain"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {item.name}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>{typeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">#{item.id}</span>
                        {item.stackable ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Stacks to {item.maxStackSize}</span>
                          </>
                        ) : null}
                      </span>
                    </div>

                    <span
                      className="hidden shrink-0 items-center gap-1.5 text-xs sm:flex"
                      style={{
                        color: `var(--rarity-text, var(--rarity-color))`,
                        ...rarityStyle(item.rarity, colors[item.rarity]),
                      }}
                    >
                      <RarityMark
                        rarity={item.rarity}
                        className="h-3.5 w-3.5"
                      />
                      {humanize(item.rarity)}
                    </span>
                    <Check
                      className={cn(
                        "ml-1 h-4 w-4 shrink-0 text-primary transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </section>

      <section
        className="bg-surface-inset/45 p-5 sm:p-6"
        aria-labelledby="development-grant-heading"
      >
        {selectedItem ? (
          <form onSubmit={onSubmit} className="flex h-full flex-col">
            <div className="flex items-center gap-4 border-b border-border pb-5">
              <div
                className="rarity-frame relative grid h-[72px] w-[72px] shrink-0 place-items-center rounded-xl p-1.5"
                data-rarity={selectedRarity}
                style={rarityStyle(selectedRarity, colors[selectedRarity])}
              >
                <Image
                  src={selectedItem.sprite}
                  alt={selectedItem.name}
                  width={72}
                  height={72}
                  className="h-full w-full rounded-lg object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Ready to grant · #{selectedItem.id}
                </p>
                <h3
                  id="development-grant-heading"
                  className="mt-1 truncate font-display text-lg font-semibold"
                >
                  {selectedItem.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedItem.itemType
                    ? humanize(selectedItem.itemType)
                    : "Uncategorized"}
                  {selectedItem.equipTo
                    ? ` · ${humanize(selectedItem.equipTo)} slot`
                    : ""}
                  {selectedItem.requiredLevel && selectedItem.requiredLevel > 1
                    ? ` · Level ${selectedItem.requiredLevel}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="space-y-5 py-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="development-rarity">Instance rarity</Label>
                  {usesTemplateRarity ? (
                    <span className="flex items-center gap-1 text-[11px] text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Item default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedRarity(selectedItem.rarity)}
                      className="flex items-center gap-1 rounded text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset to {humanize(selectedItem.rarity)}
                    </button>
                  )}
                </div>
                <Select
                  value={selectedRarity}
                  onValueChange={(value) =>
                    setSelectedRarity(value as ItemRarity)
                  }
                >
                  <SelectTrigger
                    id="development-rarity"
                    className="h-10 bg-surface-inset"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((rarity) => (
                      <SelectItem key={rarity} value={rarity}>
                        <span
                          className="flex items-center gap-2"
                          style={{
                            color: `var(--rarity-text, var(--rarity-color))`,
                            ...rarityStyle(rarity, colors[rarity]),
                          }}
                        >
                          <RarityMark rarity={rarity} className="h-3.5 w-3.5" />
                          {humanize(rarity)}
                          {rarity === selectedItem.rarity ? (
                            <span className="text-[10px] text-muted-foreground">
                              default
                            </span>
                          ) : null}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Starts at this item&apos;s {humanize(selectedItem.rarity)}{" "}
                  rarity. Change it here to test another tier.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="development-quantity">Quantity</Label>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedItem.stackable
                      ? `Stack limit ${selectedItem.maxStackSize}`
                      : "One slot per item"}
                  </span>
                </div>
                <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 bg-surface-inset"
                    onClick={() => updateQuantity(quantity - 1)}
                    disabled={quantity <= 1 || isLoading}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="development-quantity"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(event) =>
                      updateQuantity(Number(event.target.value || 1))
                    }
                    className="h-10 text-center font-semibold tabular-nums"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 bg-surface-inset"
                    onClick={() => updateQuantity(quantity + 1)}
                    disabled={isLoading}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div
                  className="grid grid-cols-4 gap-2"
                  aria-label="Quantity presets"
                >
                  {QUANTITY_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={quantity === preset ? "secondary" : "ghost"}
                      size="sm"
                      className="tabular-nums"
                      onClick={() => setQuantity(preset)}
                      disabled={isLoading}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-3 border-t border-border pt-5">
              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full"
              >
                {isLoading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <PackagePlus className="h-4 w-4" />
                )}
                <span className="truncate">
                  {isLoading
                    ? "Adding to inventory…"
                    : `Grant ${quantity.toLocaleString()} × ${selectedItem.name}`}
                </span>
              </Button>

              {result ? (
                <p
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
                    result.tone === "success" &&
                      "border-success/35 bg-success/10 text-success",
                    result.tone === "warning" &&
                      "border-warning/35 bg-warning/10 text-warning",
                    result.tone === "error" &&
                      "border-danger/35 bg-danger/10 text-danger",
                  )}
                >
                  {result.text}
                </p>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground">
                  The selection stays active so you can grant repeated test
                  items.
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="grid h-full min-h-[360px] place-items-center text-center">
            <div className="max-w-[260px]">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl border border-border bg-surface-inset text-primary">
                <PackagePlus className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3
                id="development-grant-heading"
                className="mt-4 font-display text-lg font-semibold"
              >
                Select an item
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Choose one from the searchable catalog. Its image, metadata, and
                default rarity will be loaded here.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
