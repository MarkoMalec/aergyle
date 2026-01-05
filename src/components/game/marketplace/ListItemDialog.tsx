"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ItemRarity } from "~/generated/prisma/enums";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { MarketStats } from "./MarketStats";
import {
  inventoryQueryKeys,
  marketplaceQueryKeys,
  userQueryKeys,
} from "~/lib/query-keys";
import toast from "react-hot-toast";
import { Minus, Plus } from "lucide-react";

interface ListItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userItemId: number;
  itemId: number;
  itemName: string;
  sprite: string;
  rarity: ItemRarity;
  maxQuantity: number;
}

const TAX_RATE = 0.12;

export function ListItemDialog({
  isOpen,
  onClose,
  userItemId,
  itemId,
  itemName,
  sprite,
  rarity,
  maxQuantity,
}: ListItemDialogProps) {
  const [quantity, setQuantity] = useState(maxQuantity);
  const [pricePerItem, setPricePerItem] = useState<string>("");
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const listItemMutation = useMutation({
    mutationFn: async (data: { price: number; quantity: number }) => {
      if (!session?.user?.id) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          userItemId,
          price: data.price,
          quantity: data.quantity,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Failed to list item");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() });
      queryClient.invalidateQueries({ queryKey: marketplaceQueryKeys.all() });
      queryClient.invalidateQueries({
        queryKey: marketplaceQueryKeys.stats(itemId, rarity),
      });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() });
      toast.success("Item listed successfully!");
      onClose();
      setPricePerItem("");
      setQuantity(maxQuantity);
    },
    onError: (error: Error) => {
      toast.error(`Failed to list item: ${error.message}`);
    },
  });

  const handleQuantityChange = (newQuantity: number) => {
    const clamped = Math.max(1, Math.min(maxQuantity, newQuantity));
    setQuantity(clamped);
  };

  const price = parseFloat(pricePerItem) || 0;
  const totalBeforeTax = price * quantity;
  const taxAmount = totalBeforeTax * TAX_RATE;
  const totalAfterTax = totalBeforeTax - taxAmount;

  const handleList = () => {
    if (price <= 0) {
      return;
    }
    listItemMutation.mutate({ price, quantity });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>List on Market</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quantity Section */}
          <div className="space-y-2">
            <Label>Quantity</Label>
            <div className="flex items-center">
              <Input
                type="number"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={(e) =>
                  handleQuantityChange(parseInt(e.target.value) || 1)
                }
                className="flex-1 rounded-r-none border-none"
              />
              <div className="overflow-hidden rounded-r-lg">
                <Button
                  size="lg"
                  className="h-9 rounded-none border-r"
                  onClick={() => setQuantity(maxQuantity)}
                >
                  Max
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-none border-r px-4"
                  onClick={() => handleQuantityChange(quantity - 1)}
                >
                  <Minus size={12} />
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-none px-4"
                  onClick={() => handleQuantityChange(quantity + 1)}
                >
                  <Plus size={12} />
                </Button>
              </div>
            </div>
          </div>

          {/* Price Section */}
          <div className="space-y-2">
            <Label>Price per Item</Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="Enter a price here"
                value={pricePerItem}
                onChange={(e) => setPricePerItem(e.target.value)}
                className="border-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                Each
              </span>
            </div>
          </div>

          {/* Total Section */}
          <div className="space-y-2">
            <Separator className="text-sm font-semibold uppercase text-gray-300">
              Total
            </Separator>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span className="flex items-center gap-1 text-white">
                  <CoinsIcon size={14} />
                  {totalBeforeTax.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Tax (12%)</span>
                <span className="flex items-center gap-1 text-red-400">
                  <CoinsIcon size={14} />
                  {taxAmount.toFixed(2)}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between font-semibold">
                <span className="text-white">You will receive</span>
                <span className="flex items-center gap-1 text-green-400">
                  <CoinsIcon size={16} />
                  {totalAfterTax.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Market Stats Section */}
          <div className="space-y-2">
            <Separator className="text-sm font-semibold uppercase text-gray-300">
              Market
            </Separator>
            <MarketStats itemId={itemId} itemName={itemName} sprite={sprite} rarity={rarity} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleList}
            disabled={listItemMutation.isPending || price <= 0}
          >
            {listItemMutation.isPending ? "Listing..." : "Create Listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
