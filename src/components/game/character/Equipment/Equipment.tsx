"use client";

import { DroppableSlot } from "~/components/dnd/DroppableSlot";
import { useDndContext } from "~/components/dnd/DnDContext";
import { EQUIPMENT_SLOTS } from "~/utils/itemEquipTo";
import EquipmentSkeleton from "./EquipmentSkeleton";
import { EquipmentLayout } from "./EquipmentLayout";
import { EquipmentSlotIcon } from "./EquipmentSlotIcon";

export default function Equipment() {
  const { equipment, isLoading } = useDndContext();
  if (isLoading) return <EquipmentSkeleton />;
  const equippedCount = EQUIPMENT_SLOTS.filter(
    ({ slot }) => equipment[slot],
  ).length;
  return (
    <section
      className="game-panel game-equipment-panel min-w-0"
      aria-labelledby="equipment-heading"
    >
      <div className="game-panel-header">
        <div>
          <p className="game-eyebrow">Loadout</p>
          <h2 className="game-section-title" id="equipment-heading">
            Equipment
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {equippedCount} / {EQUIPMENT_SLOTS.length} equipped
        </span>
      </div>
      <div className="game-panel-body game-equipment-content">
        <EquipmentLayout
          renderSlot={({ slot, position, label, side }) => {
            const definition = EQUIPMENT_SLOTS.find(
              (candidate) => candidate.slot === slot,
            );
            if (!definition) return null;
            return (
              <DroppableSlot
                id={`equipment-${position}`}
                index={definition.index}
                slot={{ slotIndex: definition.index, item: equipment[slot] }}
                container="equipment"
                equipmentSlotType={slot}
                label={side ? `${side} ${label.toLowerCase()}` : label}
                emptyIcon={<EquipmentSlotIcon slot={slot} />}
                twoHandedItem={
                  slot === "offhand" && equipment.weapon?.twoHanded
                    ? equipment.weapon
                    : null
                }
              />
            );
          }}
        />
        <p className="game-equipment-hint">
          Drag gear onto a matching slot. Paired armor equips both sides.
        </p>
      </div>
    </section>
  );
}
