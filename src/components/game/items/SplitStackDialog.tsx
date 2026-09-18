"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { ItemArtwork } from "./ItemArtwork";
import type { ItemWithStats } from "~/types/stats";

interface SplitStackDialogProps {
  item: ItemWithStats;
  isOpen: boolean;
  onClose: () => void;
  returnFocus?: () => void;
}

export function SplitStackDialog({
  item,
  isOpen,
  onClose,
  returnFocus,
}: SplitStackDialogProps) {
  const queryClient = useQueryClient();
  const maxSplit = (item.quantity || 1) - 1;
  const [splitQuantity, setSplitQuantity] = useState(Math.floor(maxSplit / 2));

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
        const error = await response.json();
        throw new Error(error.error || "Failed to split stack");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate inventory to refetch
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() });
      onClose();
    },
  });

  const handleSplit = () => {
    if (splitQuantity < 1 || splitQuantity > maxSplit) {
      return;
    }
    splitMutation.mutate(splitQuantity);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={
          returnFocus
            ? (event) => {
                event.preventDefault();
                returnFocus();
              }
            : undefined
        }
      >
        <DialogHeader>
          <DialogTitle>Split stack</DialogTitle>
          <DialogDescription>
            Choose how many items to move into a new stack.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex items-center gap-3">
          <ItemArtwork
            src={item.sprite}
            name={item.name}
            rarity={item.rarity}
            size={56}
          />
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-muted-foreground">
              Current quantity: {item.quantity || 1}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="quantity">Amount to split (1 - {maxSplit})</Label>
            <div className="mt-2 flex items-center gap-2">
              <Button
                aria-label="Decrease split quantity"
                onClick={() => setSplitQuantity(Math.max(1, splitQuantity - 1))}
                variant="outline"
                size="sm"
                disabled={splitMutation.isPending}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={maxSplit}
                value={splitQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= maxSplit) {
                    setSplitQuantity(val);
                  }
                }}
                className="text-center"
                disabled={splitMutation.isPending}
              />
              <Button
                aria-label="Increase split quantity"
                onClick={() =>
                  setSplitQuantity(Math.min(maxSplit, splitQuantity + 1))
                }
                variant="outline"
                size="sm"
                disabled={splitMutation.isPending}
              >
                +
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-surface-inset p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original stack:</span>
              <span className="font-semibold">
                {(item.quantity || 1) - splitQuantity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New stack:</span>
              <span className="font-semibold">{splitQuantity}</span>
            </div>
          </div>

          {splitMutation.isError && (
            <div className="rounded-xl bg-destructive/15 p-3 text-sm text-danger">
              {splitMutation.error.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={splitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSplit}
            disabled={
              splitMutation.isPending ||
              splitQuantity < 1 ||
              splitQuantity > maxSplit
            }
          >
            {splitMutation.isPending ? "Splitting..." : "Split Stack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
