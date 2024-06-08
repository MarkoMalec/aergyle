"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { DroppableSlot } from "./DroppableSlot";
import { useUserContext } from "~/context/userContext";

export type InventoryItem = {
  id: number;
  name: string;
  sprite: string;
  stat1: string;
  stat2: string;
  price: number;
};

export type InventorySlot = {
  slotIndex: number;
  item: InventoryItem;
};

const Inventory: React.FC = () => {
  const { user } = useUserContext();

  const [inventory, setInventory] = useState<InventorySlot[]>([]);

  const fetchInventory = async () => {
    try {
      const response = await fetch(`/api/inventory?userId=${user?.id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Error fetching inventory");
      }

      const data = await response.json();
      setInventory(data.inventory.slots);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setInventory([]);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchInventory();
    }
  }, [user?.id]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !active) return;

    const activeIndex = active.data.current?.index;
    const overIndex = over.data.current?.index;

    if (activeIndex !== undefined && overIndex !== undefined) {
      const newSlots = [...inventory];

      // If item is dropped onto an existing item, swap them
      // otherwise just move it to an empty slot
      if (newSlots[overIndex]?.item !== null) {
        // @ts-ignore
        [newSlots[activeIndex].item, newSlots[overIndex].item] = [
          newSlots[overIndex]?.item,
          newSlots[activeIndex]?.item,
        ];
      } else {
        //@ts-ignore
        newSlots[overIndex].item = newSlots[activeIndex]?.item;
        //@ts-ignore
        newSlots[activeIndex].item = null;
      }

      setInventory(newSlots);

      const success = await updateInventoryOrder(newSlots);

      if (!success) {
        setInventory(inventory);
      }
    }
  };

  const updateInventoryOrder = async (
    newSlots: InventorySlot[],
  ): Promise<boolean> => {
    const slotsToSend = newSlots.map((slot) => ({
      slotIndex: slot.slotIndex,
      item: slot.item ? { id: slot.item.id } : null,
    }));

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user?.id, inventory: slotsToSend }),
      });

      if (!response.ok) {
        throw new Error("Error updating inventory order");
      }

      return true;
    } catch (error) {
      console.error("Error updating inventory order:", error);
      return false;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      id="unique-id"
    >
      <div className="flex flex-wrap gap-3">
        {inventory.map((slot, index) => (
          <DroppableSlot
            key={index}
            id={`droppable-${index}`}
            index={index}
            slot={slot}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default Inventory;
