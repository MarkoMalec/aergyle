"use client";

import { useDroppable } from "@dnd-kit/core";
import { DraggableItem } from "./DraggableItem";
import { InventorySlot } from "./DnDContext";
import { useState, useEffect } from "react";
import { SplitStackDialog } from "../game/items/SplitStackDialog";

export const DroppableSlot = ({
  id,
  index,
  slot,
  container,
  equipmentSlotType,
  label,
}: {
  id: string;
  index: number;
  slot: InventorySlot;
  container: string;
  equipmentSlotType?: string;
  label?: string;
}) => {
  const { isOver, setNodeRef, active } = useDroppable({
    id,
    data: {
      index,
      container,
    },
  });

  const [highlight, setHighlight] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);

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
      (isOver && container === "inventory") || 
      (isOver && container === "delete") ||
      highlight
        ? container === "delete" ? "red" : "lightblue"
        : undefined,
    borderWidth:
      (isOver && container === "inventory") || 
      (isOver && container === "delete") ||
      highlight 
        ? "2px" 
        : undefined,
    boxShadow:
      (isOver && container === "inventory") || highlight
        ? "inset 2px 2px 10px black"
        : (isOver && container === "delete")
        ? "inset 2px 2px 10px rgba(255, 0, 0, 0.5)"
        : undefined,
  };

  const containerClass = container === "delete" 
    ? "flex h-[62px] w-[62px] items-center justify-center rounded bg-red-900/20 shadow-lg border-2 border-red-500/30"
    : "flex h-[62px] w-[62px] items-center justify-center rounded bg-white/5 shadow-lg";

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Only show split dialog for inventory items (not equipment or delete slot)
    if (container === "inventory" && slot.item && slot.item.quantity && slot.item.quantity > 1) {
      setShowSplitDialog(true);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`${containerClass} relative`}
        onContextMenu={handleRightClick}
      >
        {slot.item ? (
          <>
            <DraggableItem
              id={`draggable-${index}`}
              index={index}
              item={slot.item}
              sprite={slot.item.sprite}
              container={container}
            />
          </>
        ) : (
          <small>{label ?? (equipmentSlotType && equipmentSlotType)}</small>
        )}
      </div>

      {/* Split stack dialog */}
      {slot.item && (
        <SplitStackDialog
          item={slot.item}
          isOpen={showSplitDialog}
          onClose={() => setShowSplitDialog(false)}
        />
      )}
    </>
  );
};
