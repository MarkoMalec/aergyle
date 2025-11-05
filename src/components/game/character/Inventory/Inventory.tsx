"use client";

import React from "react";
import { DroppableSlot } from "../../../dnd/DroppableSlot";
import { useDndContext } from "~/components/dnd/DnDContext";

const Inventory = () => {
  const { inventory } = useDndContext();

  return (
    <div className="flex flex-wrap gap-3">
      {inventory.map((slot, index) => (
        <DroppableSlot
          key={index}
          id={`inventory-${index}`}
          index={index}
          slot={slot}
          container="inventory"
        />
      ))}
    </div>
  );
};

export default Inventory;

