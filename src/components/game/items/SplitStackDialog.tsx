"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { ItemWithStats } from "~/types/stats";

interface SplitStackDialogProps {
  item: ItemWithStats;
  onClose: () => void;
}

export function SplitStackDialog({ item, onClose }: SplitStackDialogProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-zinc-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Split Stack</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={splitMutation.isPending}
          >
            ✕
          </button>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <img src={item.sprite} alt={item.name} className="h-12 w-12" />
          <div>
            <div className="font-medium text-white">{item.name}</div>
            <div className="text-sm text-gray-400">
              Current quantity: {item.quantity || 1}
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div>
            <Label htmlFor="quantity" className="text-white">
              Amount to split (1 - {maxSplit})
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <Button
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

          <div className="rounded bg-zinc-800 p-3 text-sm text-gray-300">
            <div className="flex justify-between">
              <span>Original stack:</span>
              <span className="font-semibold">
                {(item.quantity || 1) - splitQuantity}
              </span>
            </div>
            <div className="flex justify-between">
              <span>New stack:</span>
              <span className="font-semibold">{splitQuantity}</span>
            </div>
          </div>

          {splitMutation.isError && (
            <div className="rounded bg-red-900/20 p-3 text-sm text-red-400">
              {splitMutation.error.message}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={splitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSplit}
            className="flex-1"
            disabled={
              splitMutation.isPending ||
              splitQuantity < 1 ||
              splitQuantity > maxSplit
            }
          >
            {splitMutation.isPending ? "Splitting..." : "Split Stack"}
          </Button>
        </div>
      </div>
    </div>
  );
}
