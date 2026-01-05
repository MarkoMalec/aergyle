"use client";

import React from "react";
import { DroppableSlot } from "../../../dnd/DroppableSlot";
import { useDndContext } from "~/components/dnd/DnDContext";
import EquipmentSkeleton from "./EquipmentSkeleton";

const Equipment = () => {
  const { equipment, isLoading } = useDndContext();

  if (isLoading) {
    return <EquipmentSkeleton />;
  }

  return (
    <div className="flex w-full gap-10">
      <div className="flex flex-col justify-end space-y-2">
        <DroppableSlot
          id={`equipment-main-weapon`}
          index={113}
          slot={{ slotIndex: 113, item: equipment.weapon }}
          container="equipment"
          equipmentSlotType="weapon"
        />
        {/* <DroppableSlot
            id={`equipment-fellingAxe`}
            index={114}
            slot={{ slotIndex: 114, item: equipment.fellingAxe }}
            container="equipment"
            equipmentSlotType="fellingAxe"
            label="Felling Axe"
          />
          <DroppableSlot
            id={`equipment-pickaxe`}
            index={115}
            slot={{ slotIndex: 115, item: equipment.pickaxe }}
            container="equipment"
            equipmentSlotType="pickaxe"
            label="Pickaxe"
          /> */}
        {/* <DroppableSlot
          id={`equipment-offhand-weapon`}
          index={114}
          slot={{ slotIndex: 114, item: equipment.offhandWeapon }}
          container="equipment"
          equipmentSlotType="offhandWeapon"
        /> */}
      </div>

      <div className="w-full max-w-[280px] space-y-2">
        <div className="flex flex-col items-center justify-center space-y-2">
          <DroppableSlot
            id={`equipment-head`}
            index={100}
            slot={{ slotIndex: 100, item: equipment.head }}
            container="equipment"
            equipmentSlotType="head"
          />
          {/* ROW 2 */}
          <div className="flex w-full justify-between">
            <DroppableSlot
              id={`equipment-pauldrons`}
              index={102}
              slot={{ slotIndex: 102, item: equipment.pauldrons }}
              container="equipment"
              equipmentSlotType="pauldrons"
            />
            <DroppableSlot
              id={`equipment-necklace`}
              index={101}
              slot={{ slotIndex: 101, item: equipment.necklace }}
              container="equipment"
              equipmentSlotType="necklace"
            />
            <DroppableSlot
              id={`equipment-pauldrons`}
              index={102}
              slot={{ slotIndex: 102, item: equipment.pauldrons }}
              container="equipment"
              equipmentSlotType="pauldrons"
            />
          </div>
        </div>
        {/* ROW 3 */}
        <div className="flex justify-between">
          <DroppableSlot
            id={`equipment-bracers`}
            index={104}
            slot={{ slotIndex: 104, item: equipment.bracers }}
            container="equipment"
            equipmentSlotType="bracers"
          />
          <DroppableSlot
            id={`equipment-chest`}
            index={103}
            slot={{ slotIndex: 103, item: equipment.chest }}
            container="equipment"
            equipmentSlotType="chest"
          />
          <DroppableSlot
            id={`equipment-bracers`}
            index={104}
            slot={{ slotIndex: 104, item: equipment.bracers }}
            container="equipment"
            equipmentSlotType="bracers"
          />
        </div>

        <div className="flex justify-between">
          <DroppableSlot
            id={`equipment-belt`}
            index={108}
            slot={{ slotIndex: 108, item: equipment.belt }}
            container="equipment"
            equipmentSlotType="belt"
          />
          <DroppableSlot
            id={`equipment-gloves`}
            index={105}
            slot={{ slotIndex: 105, item: equipment.gloves }}
            container="equipment"
            equipmentSlotType="gloves"
          />
        </div>
        <div className="flex justify-between">
          <DroppableSlot
            id={`equipment-greaves`}
            index={106}
            slot={{ slotIndex: 106, item: equipment.greaves }}
            container="equipment"
            equipmentSlotType="greaves"
          />
          <DroppableSlot
            id={`equipment-boots`}
            index={107}
            slot={{ slotIndex: 107, item: equipment.boots }}
            container="equipment"
            equipmentSlotType="boots"
          />
        </div>
      </div>
      <div className="flex flex-col justify-between gap-2">
        <div className="flex justify-between">
          <DroppableSlot
            id={`equipment-amulet`}
            index={111}
            slot={{ slotIndex: 111, item: equipment.amulet }}
            container="equipment"
            equipmentSlotType="amulet"
          />
        </div>
        <div className="space-y-2">
          <DroppableSlot
            id={`equipment-ring1`}
            index={109}
            slot={{ slotIndex: 109, item: equipment.ring1 }}
            container="equipment"
            equipmentSlotType="ring"
          />
          <DroppableSlot
            id={`equipment-ring2`}
            index={110}
            slot={{ slotIndex: 110, item: equipment.ring2 }}
            container="equipment"
            equipmentSlotType="ring"
          />
          <DroppableSlot
            id={`equipment-backpack`}
            index={112}
            slot={{ slotIndex: 112, item: equipment.backpack }}
            container="equipment"
            equipmentSlotType="backpack"
          />
        </div>
      </div>
      <div className="space-y-2">
        <DroppableSlot
          id={`equipment-fellingAxe`}
          index={114}
          slot={{ slotIndex: 114, item: equipment.fellingAxe }}
          container="equipment"
          equipmentSlotType="fellingAxe"
          label="Felling Axe"
        />
        <DroppableSlot
          id={`equipment-pickaxe`}
          index={115}
          slot={{ slotIndex: 115, item: equipment.pickaxe }}
          container="equipment"
          equipmentSlotType="pickaxe"
          label="Pickaxe"
        />
      </div>
    </div>
  );
};

export default Equipment;
