"use client";

import { useDroppable } from "@dnd-kit/core";
import { DraggableItem } from "./DraggableItem";
import { InventorySlot } from "./Inventory";

export const DroppableSlot = ({
  id,
  index,
  slot,
}: {
  id: string;
  index: number;
  slot: InventorySlot;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: {
      index,
    },
  });

  const style = {
    borderColor: isOver ? "lightblue" : undefined,
    borderWidth: isOver ? "3px" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex h-[62px] w-[62px] rounded bg-white/5 shadow-lg"
    >
      {slot.item ? (
        <DraggableItem
          id={`draggable-${index}`}
          index={index}
          item={slot.item}
          sprite={slot.item.sprite}
        />
      ) : (
        <div className="bg-grey h-full w-full"></div>
      )}
    </div>
  );
};
