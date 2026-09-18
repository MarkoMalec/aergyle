"use client";

import { useDroppable } from "@dnd-kit/core";
import { DraggableItem } from "./DraggableItem";
import type { InventorySlot } from "./DnDContext";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { rarityStyle } from "~/utils/rarity-colors";
import { Plus } from "lucide-react";
import { SplitStackDialog } from "../game/items/SplitStackDialog";

export const DroppableSlot = ({
  id,
  index,
  slot,
  container,
  equipmentSlotType,
  label,
  emptyIcon,
}: {
  id: string;
  index: number;
  slot: InventorySlot;
  container: string;
  equipmentSlotType?: string;
  label?: string;
  emptyIcon?: ReactNode;
}) => {
  const { isOver, setNodeRef, active } = useDroppable({
    id,
    data: {
      index,
      container,
    },
  });

  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const activeEquipType: unknown = active?.data.current?.equipType;
  const highlight =
    typeof activeEquipType === "string" &&
    activeEquipType === equipmentSlotType;

  const { colors } = useRarityColors();
  const style = slot.item
    ? rarityStyle(slot.item.rarity, colors[slot.item.rarity])
    : undefined;

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Only show split dialog for inventory items (not equipment or delete slot)
    if (
      container === "inventory" &&
      slot.item?.quantity &&
      slot.item.quantity > 1
    ) {
      setShowSplitDialog(true);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`game-slot${slot.item ? " rarity-frame" : ""}`}
        data-rarity={slot.item?.rarity}
        data-equipped={container === "equipment" && !!slot.item}
        data-delete={container === "delete"}
        data-over={isOver}
        data-highlight={highlight}
        aria-label={
          !slot.item
            ? container === "delete"
              ? "Discard slot"
              : `Empty ${label ?? "inventory"} slot`
            : undefined
        }
        onContextMenu={handleRightClick}
      >
        {slot.item ? (
          <>
            <DraggableItem
              id={`draggable-${id}`}
              index={index}
              item={slot.item}
              sprite={slot.item.sprite}
              container={container}
              slotLabel={container === "equipment" ? label : undefined}
            />
          </>
        ) : container === "equipment" ? (
          emptyIcon ?? (
            <Plus
              className="h-4 w-4 text-muted-foreground/50"
              aria-hidden="true"
            />
          )
        ) : null}
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
