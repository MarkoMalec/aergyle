"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, Split } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import { rarityStyle } from "~/utils/rarity-colors";
import { ItemArtwork } from "./ItemArtwork";
import type { ItemWithStats } from "~/types/stats";

interface SplitStackDialogProps {
  item: ItemWithStats;
  isOpen: boolean;
  onClose: () => void;
  returnFocus?: () => void;
}

const tintedButtonClass =
  "bg-surface-inset/70 text-foreground hover:bg-surface-inset hover:text-foreground";

export function SplitStackDialog({
  item,
  isOpen,
  onClose,
  returnFocus,
}: SplitStackDialogProps) {
  const { colors } = useRarityColors();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="border-0 bg-popover bg-[image:linear-gradient(150deg,color-mix(in_srgb,var(--rarity-color)_12%,transparent),transparent_180px)] sm:max-w-md"
        style={rarityStyle(item.rarity, colors[item.rarity])}
        onCloseAutoFocus={
          returnFocus
            ? (event) => {
                event.preventDefault();
                returnFocus();
              }
            : undefined
        }
      >
        {/* Mounted per opening, so every split starts from half the current stack. */}
        <SplitStackForm item={item} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function SplitStackForm({
  item,
  onClose,
}: {
  item: ItemWithStats;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const total = item.quantity ?? 1;
  const maxSplit = total - 1;
  const [splitQuantity, setSplitQuantity] = useState(
    Math.max(1, Math.floor(total / 2)),
  );
  // What the player is typing, kept apart so the field can be cleared mid-edit.
  const [draft, setDraft] = useState<string | null>(null);

  const splitMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const response = await fetch("/api/inventory/split-stack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userItemId: item.id,
          splitQuantity: quantity,
        }),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(error?.error ?? "Failed to split stack");
      }

      return response.json() as Promise<unknown>;
    },
    onSuccess: () => {
      // Invalidate inventory to refetch
      void queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.all(),
      });
      onClose();
    },
  });

  const clamp = (value: number) => Math.min(maxSplit, Math.max(1, value));
  const setAmount = (value: number) => {
    setDraft(null);
    setSplitQuantity(clamp(value));
  };
  const isValid = splitQuantity >= 1 && splitQuantity <= maxSplit;
  const fill =
    maxSplit > 1 ? ((splitQuantity - 1) / (maxSplit - 1)) * 100 : 100;

  // Fractions that land on 1, Max or each other on small stacks are dropped.
  const quickPicks: Array<[string, number]> = [
    ["1", 1],
    ...(
      [
        ["¼", Math.floor(total / 4)],
        ["½", Math.floor(total / 2)],
        ["¾", Math.floor((total * 3) / 4)],
      ] as Array<[string, number]>
    ).filter(([, value], index, all) => {
      return (
        value > 1 &&
        value < maxSplit &&
        all.findIndex(([, other]) => other === value) === index
      );
    }),
    ["Max", maxSplit],
  ];

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (isValid && !splitMutation.isPending) {
          splitMutation.mutate(splitQuantity);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Split stack</DialogTitle>
        <DialogDescription>
          <span className="game-item-name font-semibold">{item.name}</span>
          <span className="tabular-nums">{` · ${total.toLocaleString()} in stack`}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-start justify-center gap-4 rounded-xl bg-surface-inset/70 px-4 py-5">
        <div className="flex w-28 flex-col items-center gap-2">
          <ItemArtwork
            src={item.sprite}
            name={item.name}
            rarity={item.rarity}
            size={72}
          />
          <span className="flex h-9 items-center text-2xl font-semibold tabular-nums">
            {(total - splitQuantity).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">Stays</span>
        </div>
        <ArrowRight
          className="mt-7 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="flex w-28 flex-col items-center gap-2">
          <ItemArtwork
            src={item.sprite}
            name={item.name}
            rarity={item.rarity}
            size={72}
          />
          {maxSplit > 1 ? (
            <input
              aria-label={`Amount to split, 1 to ${maxSplit}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={maxSplit}
              value={draft ?? splitQuantity}
              onChange={(event) => {
                setDraft(event.target.value);
                const parsed = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(parsed)) setSplitQuantity(clamp(parsed));
              }}
              onBlur={() => setDraft(null)}
              onFocus={(event) => event.target.select()}
              disabled={splitMutation.isPending}
              className="h-9 w-24 rounded-lg bg-primary/15 text-center text-2xl font-semibold tabular-nums text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:bg-primary/25"
            />
          ) : (
            <span className="flex h-9 items-center text-2xl font-semibold tabular-nums text-primary">
              1
            </span>
          )}
          <span className="text-xs text-muted-foreground">New stack</span>
        </div>
      </div>

      {maxSplit > 1 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Split one fewer"
              className={cn("h-9 w-9 shrink-0", tintedButtonClass)}
              onClick={() => setAmount(splitQuantity - 1)}
              disabled={splitMutation.isPending || splitQuantity <= 1}
            >
              <Minus className="h-4 w-4" aria-hidden />
            </Button>
            <input
              type="range"
              aria-label="Amount to split"
              min={1}
              max={maxSplit}
              value={splitQuantity}
              onChange={(event) => setAmount(event.target.valueAsNumber)}
              disabled={splitMutation.isPending}
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) ${fill}%, hsl(var(--surface-inset)) ${fill}%)`,
              }}
              className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-popover disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-[0_0_0_4px_hsl(var(--primary)/0.2)] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Split one more"
              className={cn("h-9 w-9 shrink-0", tintedButtonClass)}
              onClick={() => setAmount(splitQuantity + 1)}
              disabled={splitMutation.isPending || splitQuantity >= maxSplit}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="flex gap-2">
            {quickPicks.map(([label, value]) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "flex-1",
                  splitQuantity === value
                    ? "bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary"
                    : "bg-surface-inset/70 text-muted-foreground hover:bg-surface-inset hover:text-foreground",
                )}
                onClick={() => setAmount(value)}
                disabled={splitMutation.isPending}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {splitMutation.isError && (
        <div className="rounded-xl bg-destructive/15 p-3 text-sm text-danger">
          {splitMutation.error.message}
        </div>
      )}

      <DialogFooter className="sm:space-x-0">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className={cn("h-9", tintedButtonClass)}
          disabled={splitMutation.isPending}
        >
          Cancel
        </Button>
        {/* Opening lands here, so Enter confirms the suggested half. */}
        <Button
          type="submit"
          autoFocus
          className="h-9 border-0"
          disabled={splitMutation.isPending || !isValid}
        >
          <Split className="h-4 w-4" aria-hidden />
          {splitMutation.isPending
            ? "Splitting..."
            : `Split off ${splitQuantity.toLocaleString()}`}
        </Button>
      </DialogFooter>
    </form>
  );
}
