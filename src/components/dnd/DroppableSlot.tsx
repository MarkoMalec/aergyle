"use client";

import { useDroppable } from "@dnd-kit/core";
import { DraggableItem } from "./DraggableItem";
import { InventorySlot } from "./DnDContext";
import { useState, useEffect } from "react";

export const DroppableSlot = ({
  id,
  index,
  slot,
  container,
  equipmentSlotType,
}: {
  id: string;
  index: number;
  slot: InventorySlot;
  container: string;
  equipmentSlotType?: string;
}) => {
  const { isOver, setNodeRef, active } = useDroppable({
    id,
    data: {
      index,
      container,
    },
  });

  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (active && active.data.current) {
      const activeEquipType = active.data.current.equipType;
      setHighlight(activeEquipType === equipmentSlotType);
    } else {
      setHighlight(false);
    }
  }, [active, equipmentSlotType]);

  const style = {
    borderColor:
      (isOver && container === "inventory") || highlight
        ? "lightblue"
        : undefined,
    borderWidth:
      (isOver && container === "inventory") || highlight ? "1px" : undefined,
    boxShadow:
      (isOver && container === "inventory") || highlight
        ? "inset 2px 2px 10px black"
        : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg"
    >
      {slot.item ? (
        <DraggableItem
          id={`draggable-${index}`}
          index={index}
          item={slot.item}
          sprite={slot.item.sprite}
          container={container}
        />
      ) : (
        <small>{equipmentSlotType && equipmentSlotType}</small>
      )}
    </div>
  );
};
