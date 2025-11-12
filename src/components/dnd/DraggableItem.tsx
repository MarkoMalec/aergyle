"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PopoverTrigger } from "~/components/ui/popover";
import Image from "next/image";
import { Skeleton } from "~/components/ui/skeleton";
import { useDndContext } from "./DnDContext";
import { EQUIPMENT_SLOT_TO_INDEX } from "~/types/inventory";
import { ItemWithStats } from "~/types/stats";
import toast from "react-hot-toast";
import SingleItemTemplate from "~/components/game/items/single-item-template";

export const DraggableItem = ({
  id,
  index,
  item,
  sprite,
  container,
}: {
  id: string;
  index: number;
  item: ItemWithStats;
  sprite: string;
  container: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: {
        index,
        container,
        equipType: item.equipTo,
      },
    });

  const { inventory, equipment } = useDndContext();

  const style = {
    transform: CSS.Transform.toString(transform),
    boxShadow: isDragging ? "0px 3px 10px rgba(0, 0, 0, 0.64)" : undefined,
    zIndex: isDragging ? 999 : undefined,
  };

  if (!item) {
    return <Skeleton className="h-[62px] w-[62px] rounded"></Skeleton>;
  }

  const handleEquip = () => {
    if (container === "inventory" && item.equipTo) {
      // Find the equipment slot based on item type
      const targetSlot = item.equipTo as keyof typeof EQUIPMENT_SLOT_TO_INDEX;

      // For rings, find first available ring slot
      if (item.equipTo === "ring") {
        if (!equipment.ring1) {
          // Equip to ring1
          const event = new CustomEvent("quickEquip", {
            detail: {
              fromContainer: "inventory",
              fromIndex: index,
              toContainer: "equipment",
              toIndex: EQUIPMENT_SLOT_TO_INDEX.ring1,
            },
          });
          window.dispatchEvent(event);
        } else if (!equipment.ring2) {
          // Equip to ring2
          const event = new CustomEvent("quickEquip", {
            detail: {
              fromContainer: "inventory",
              fromIndex: index,
              toContainer: "equipment",
              toIndex: EQUIPMENT_SLOT_TO_INDEX.ring2,
            },
          });
          window.dispatchEvent(event);
        } else {
          toast.error("All ring slots are occupied");
        }
      } else if (
        targetSlot &&
        EQUIPMENT_SLOT_TO_INDEX[targetSlot] !== undefined
      ) {
        // Equip to the appropriate slot
        const event = new CustomEvent("quickEquip", {
          detail: {
            fromContainer: "inventory",
            fromIndex: index,
            toContainer: "equipment",
            toIndex: EQUIPMENT_SLOT_TO_INDEX[targetSlot],
          },
        });
        window.dispatchEvent(event);
      }
    }
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
        {...attributes}
        {...listeners}
        className="flex h-[62px] w-[62px] items-center justify-center rounded bg-[grey] text-center text-sm shadow"
      >
        <PopoverTrigger asChild>
          <button type="button" className="relative h-full w-full">
            <Image
              alt={item.name}
              src={sprite}
              width={62}
              height={62}
              className="rounded"
            />
            {item.quantity && item.quantity > 1 && (
              <div className="absolute -left-1 -top-2 flex items-center justify-center rounded-md border bg-background px-2 text-xs text-white">
                {item.quantity}
              </div>
            )}
          </button>
        </PopoverTrigger>
      </div>
    </SingleItemTemplate>
  );
};
