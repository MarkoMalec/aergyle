"use client";

import { Item } from "@prisma/client";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import Image from "next/image";
import { Skeleton } from "~/components/ui/skeleton";
import { useDndContext } from "./DnDContext";
import {
  EQUIPMENT_SLOT_TO_INDEX,
} from "~/types/inventory";
import { useState } from "react";

export const DraggableItem = ({
  id,
  index,
  item,
  sprite,
  container,
}: {
  id: string;
  index: number;
  item: Item;
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
  const [open, setOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    boxShadow: isDragging ? "0px 5px 10px black" : undefined,
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
          setOpen(false);
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
          setOpen(false);
        } else {
          alert("All ring slots are occupied");
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
        setOpen(false);
      }
    }
  };

  const handleUnequip = () => {
    if (container === "equipment") {
      // Find first empty inventory slot
      const emptySlotIndex = inventory.findIndex((slot) => !slot.item);

      if (emptySlotIndex === -1) {
        alert("Inventory is full");
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
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex h-[62px] w-[62px] items-center justify-center rounded bg-[grey] text-center text-sm shadow"
      >
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
      </div>
      <PopoverContent>
        <h3 className="bold mb-3 text-xl">{item.name}</h3>
        <ul className="space-y-2">
          <li>{item.stat1}</li>
          <li>{item.stat2}</li>
        </ul>
        <div className="mt-4 border-t pt-3">
          {container === "inventory" && item.equipTo && (
            <button
              onClick={handleEquip}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
            >
              Equip
            </button>
          )}
          {container === "equipment" && (
            <button
              onClick={handleUnequip}
              className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
            >
              Unequip
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
