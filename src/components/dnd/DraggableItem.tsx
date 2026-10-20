"use client";

import { useDraggable } from "@dnd-kit/core";
import { PopoverTrigger } from "~/components/ui/popover";
import Image from "next/image";
import { Skeleton } from "~/components/ui/skeleton";
import { useDndContext } from "./DnDContext";
import {
  EQUIPMENT_SLOT_TO_INDEX,
  type EquipmentSlotKey,
} from "~/utils/itemEquipTo";
import { getQuickEquipSlot } from "~/utils/inventoryClient";
import type { ItemWithStats } from "~/types/stats";
import toast from "react-hot-toast";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";
import SingleItemTemplate from "~/components/game/items/single-item-template";

export const DraggableItem = ({
  id,
  index,
  item,
  sprite,
  container,
  slotLabel,
}: {
  id: string;
  index: number;
  item: ItemWithStats;
  sprite: string;
  container: string;
  slotLabel?: string;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      index,
      container,
      item,
      equipType: item.equipTo,
      twoHanded: item.twoHanded,
    },
  });

  const { inventory, equipment } = useDndContext();

  // DnDContext draws the moving copy in its DragOverlay.
  const style = { opacity: isDragging ? 0 : undefined };

  if (!item) {
    return <Skeleton className="h-[62px] w-[62px] rounded"></Skeleton>;
  }

  const handleEquip = (slot?: EquipmentSlotKey) => {
    if (container !== "inventory" || !item.equipTo) return;
    const targetSlot = slot ?? getQuickEquipSlot(item, equipment);
    if (!targetSlot) {
      if (item.equipTo === "ring") toast.error("All ring slots are occupied");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("quickEquip", {
        detail: {
          fromContainer: "inventory",
          fromIndex: index,
          toContainer: "equipment",
          toIndex: EQUIPMENT_SLOT_TO_INDEX[targetSlot],
        },
      }),
    );
  };

  const handleUnequip = () => {
    if (container === "equipment") {
      // Find first empty inventory slot
      const emptySlotIndex = inventory.findIndex((slot) => !slot.item);

      if (emptySlotIndex === -1) {
        toast.error("Inventory is full");
        return;
      }

      const event = new CustomEvent("quickEquip", {
        detail: {
          fromContainer: "equipment",
          fromIndex: index,
          toContainer: "inventory",
          toIndex: emptySlotIndex,
        },
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <SingleItemTemplate
      item={item}
      sprite={sprite}
      container={container}
      index={index}
      onEquip={handleEquip}
      onUnequip={handleUnequip}
      showEquipButton={container === "inventory" && !!item.equipTo}
      showUnequipButton={container === "equipment"}
      showListButton={container === "inventory"}
    >
      <div
        ref={setNodeRef}
        style={style}
        data-dragging={isDragging}
        className="flex h-full w-full items-center justify-center text-center text-sm"
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="game-item-trigger"
            aria-label={`${slotLabel ? `${slotLabel}: ` : ""}${item.name}, ${item.rarity.toLowerCase()}${item.quantity && item.quantity > 1 ? `, quantity ${item.quantity}` : ""}. Item details`}
          >
            <Image
              alt={item.name}
              src={sprite}
              width={102}
              height={102}
              className="object-contain"
            />
            <ItemRarityMark rarity={item.rarity} />
            {item.quantity && item.quantity > 1 && (
              <div className="game-item-quantity">{item.quantity}</div>
            )}
          </button>
        </PopoverTrigger>
      </div>
    </SingleItemTemplate>
  );
};
