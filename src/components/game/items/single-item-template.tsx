"use client";

import Image from "next/image";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { ItemWithStats } from "~/types/stats";
import { formatItemStatsForDisplay } from "~/utils/stats";
import { RarityBadge } from "~/utils/ui/rarity-badge";
import { useSession } from "next-auth/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { getRarityTailwindClass } from "~/utils/rarity-colors";
import { CoinsIcon } from "../ui/coins-icon";
import { userQueryKeys, inventoryQueryKeys, marketplaceQueryKeys } from "~/lib/query-keys";

interface SingleItemTemplateProps {
  item: ItemWithStats;
  sprite: string;
  container?: string;
  index?: number;
  onEquip?: () => void;
  onUnequip?: () => void;
  showEquipButton?: boolean;
  showUnequipButton?: boolean;
  showListButton?: boolean;
  children?: React.ReactNode; // For the image/trigger wrapper
}

export default function SingleItemTemplate({
  item,
  sprite,
  container,
  index,
  onEquip,
  onUnequip,
  showEquipButton = false,
  showUnequipButton = false,
  showListButton = false,
  children,
}: SingleItemTemplateProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [listPrice, setListPrice] = useState("");

  const { colors } = useRarityColors();
  const hexColor = colors[item.rarity];
  const textColorClass = getRarityTailwindClass(item.rarity, hexColor, "text");

  // List item on marketplace mutation
  const listItemMutation = useMutation({
    mutationFn: async ({
      userItemId,
      price,
    }: {
      userItemId: number;
      price: number;
    }) => {
      if (!session?.user?.id) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          userItemId,
          price,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to list item");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() });
      queryClient.invalidateQueries({ queryKey: marketplaceQueryKeys.all() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() });
      toast.success("Item listed successfully!");
      setOpen(false);
      setShowListForm(false);
      setListPrice("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to list item: ${error.message}`);
    },
  });

  const handleListItem = () => {
    const price = parseFloat(listPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    if (!item.id) {
      toast.error("Item ID not found");
      return;
    }

    listItemMutation.mutate({ userItemId: item.id, price });
  };

  const handleEquipClick = () => {
    if (onEquip) {
      onEquip();
      setOpen(false);
    }
  };

  const handleUnequipClick = () => {
    if (onUnequip) {
      onUnequip();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {children || (
        <PopoverTrigger asChild>
          <button type="button" className="h-full w-full">
            <Image
              alt={item.name}
              src={sprite}
              width={62}
              height={62}
              className="rounded"
            />
          </button>
        </PopoverTrigger>
      )}
      <PopoverContent className="bg-gray-900/90 backdrop-blur-lg">
        <div className="mb-4 flex flex-col items-start">
          <h3 className={`text-md mb-1 font-bold ${textColorClass}`}>
            {item.name}
          </h3>
          <RarityBadge rarity={item.rarity} />
        </div>
        {item.stats && item.stats.length > 0 ? (
          <ul className="space-y-2">
            {formatItemStatsForDisplay(item.stats).map((stat, idx) => (
              <li key={idx} className="text-sm" style={{ color: stat.color }}>
                <span className="mr-1">{stat.icon}</span>
                {stat.label}: {stat.value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No stats</p>
        )}
        <div className="py-2">
          <div className="ml-auto w-fit">
            <span className="text-sm text-yellow-500"><CoinsIcon /> {item.price}</span>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t pt-3">
          {showEquipButton && (
            <button
              onClick={handleEquipClick}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              Equip
            </button>
          )}
          {showUnequipButton && (
            <button
              onClick={handleUnequipClick}
              className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
            >
              Unequip
            </button>
          )}
          {showListButton && !showListForm && (
            <button
              onClick={() => setShowListForm(true)}
              className="w-full rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
            >
              List on Marketplace
            </button>
          )}
          {showListForm && (
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Enter price in gold"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="w-full"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowListForm(false);
                    setListPrice("");
                  }}
                  className="flex-1 rounded bg-gray-600 px-3 py-2 text-sm text-white hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleListItem}
                  disabled={listItemMutation.isPending}
                  className="flex-1 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {listItemMutation.isPending ? "Listing..." : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}