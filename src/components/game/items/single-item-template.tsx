"use client";

import Image from "next/image";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import { useState } from "react";
import { ItemWithStats } from "~/types/stats";
import { formatItemStatsForDisplay } from "~/utils/stats";
import { RarityBadge } from "~/utils/ui/rarity-badge";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { getRarityTailwindClass } from "~/utils/rarity-colors";
import { CoinsIcon } from "../ui/coins-icon";
import { useEquipmentContext } from "~/context/equipmentContext";
import { Badge } from "~/components/ui/badge";
import { ListItemDialog } from "~/components/game/marketplace/ListItemDialog";
import { cn } from "~/lib/utils";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import { Separator } from "~/components/ui/separator";

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
  className?: string;
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
  className,
}: SingleItemTemplateProps) {
  const [open, setOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);

  const { active: isActionActive } = useVocationalActiveActionContext();

  const { equipment } = useEquipmentContext();

  const { colors } = useRarityColors();
  const hexColor = colors[item.rarity];
  const textColorClass = getRarityTailwindClass(item.rarity, hexColor, "text");

  const handleEquipClick = () => {
    if (isActionActive) return;
    if (onEquip) {
      onEquip();
      setOpen(false);
    }
  };

  const handleUnequipClick = () => {
    if (isActionActive) return;
    if (onUnequip) {
      onUnequip();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {children || (
        <PopoverTrigger asChild>
          <button type="button" className={`h-12 w-12 ${cn(className)}`}>
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
      <PopoverContent className="min-w-[350px] bg-gray-900/50 backdrop-blur-lg">
        <div className="mb-4 flex flex-col items-start">
          <h3 className={`text-md mb-1 font-bold ${textColorClass}`}>
            {item.name}
          </h3>
          <RarityBadge rarity={item.rarity} />
          <Badge className="absolute right-2 top-2 capitalize">
            {item.equipTo}
          </Badge>
        </div>
        {item.description ? (
          <>
            <Separator className="mb-4" />
            <div className="mb-4 text-xs text-white/80">{item.description}</div>
            <Separator className="mb-4" />
          </>
        ) : null}
        {item.stats && item.stats.length > 0 ? (
          <ul className="space-y-2">
            {formatItemStatsForDisplay(item.stats).map((stat, idx) => (
              <li key={idx} className="text-sm" style={{ color: stat.color }}>
                <span className="mr-1">{stat.icon}</span>
                {stat.label}: {stat.value}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="py-2">
          <div className="ml-auto w-fit">
            <span className="text-sm text-yellow-500">
              <CoinsIcon /> {item.price}
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t pt-3">
          {showEquipButton && (
            <button
              disabled={isActionActive}
              onClick={handleEquipClick}
              className={cn(
                "w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700",
                isActionActive && "cursor-not-allowed opacity-50",
              )}
            >
              Equip
            </button>
          )}
          {showUnequipButton && (
            <button
              disabled={isActionActive}
              onClick={handleUnequipClick}
              className={cn(
                "w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700",
                isActionActive && "cursor-not-allowed opacity-50",
              )}
            >
              Unequip
            </button>
          )}
          {showListButton && (
            <button
              onClick={() => {
                setListDialogOpen(true);
                setOpen(false);
              }}
              className="w-full rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
            >
              List on Marketplace
            </button>
          )}
        </div>
      </PopoverContent>

      {/* List Item Dialog */}
      {item.id && (
        <ListItemDialog
          isOpen={listDialogOpen}
          onClose={() => setListDialogOpen(false)}
          userItemId={item.id}
          itemId={item.itemId}
          itemName={item.name}
          sprite={sprite}
          rarity={item.rarity}
          maxQuantity={item.quantity || 1}
        />
      )}
    </Popover>
  );
}
