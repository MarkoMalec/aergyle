"use client";

import { useDroppable } from "@dnd-kit/core";
import Image from "next/image";
import { DraggableItem } from "./DraggableItem";
import type { InventorySlot } from "./DnDContext";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { rarityStyle } from "~/utils/rarity-colors";
import { canEquipToSlot } from "~/utils/inventoryClient";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";
import type { ItemWithStats } from "~/types/stats";
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
  twoHandedItem,
}: {
  id: string;
  index: number;
  slot: InventorySlot;
  container: string;
  equipmentSlotType?: string;
  label?: string;
  emptyIcon?: ReactNode;
  /** The main hand's two-handed weapon, shown dimmed in the empty off hand. */
  twoHandedItem?: ItemWithStats | null;
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
    !!equipmentSlotType &&
    canEquipToSlot(
      {
        equipTo: activeEquipType,
        twoHanded: active?.data.current?.twoHanded === true,
      },
      equipmentSlotType,
    );

  const { colors } = useRarityColors();
  const ghost = slot.item ? null : twoHandedItem;
  const shown = slot.item ?? ghost;
  const style = shown
    ? rarityStyle(shown.rarity, colors[shown.rarity])
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
        className={`game-slot${shown ? " rarity-frame" : ""}`}
        data-rarity={shown?.rarity}
        data-equipped={container === "equipment" && !!shown}
        data-two-handed-copy={!!ghost}
        data-delete={container === "delete"}
        data-over={isOver}
        data-highlight={highlight}
        aria-label={
          ghost
            ? `${label ?? "Off hand"}: held by two-handed ${ghost.name}`
            : !slot.item
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
        ) : ghost ? (
          <span className="game-item-trigger" aria-hidden="true">
            <Image
              alt=""
              src={ghost.sprite}
              width={102}
              height={102}
              className="object-contain"
            />
            <ItemRarityMark rarity={ghost.rarity} />
          </span>
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
