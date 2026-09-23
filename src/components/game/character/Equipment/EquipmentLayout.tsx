import type { ReactNode } from "react";
import type { EquipmentSlotKey } from "~/utils/itemEquipTo";

export interface EquipmentPosition {
  slot: EquipmentSlotKey;
  position: string;
  label: string;
  side?: "left" | "right";
}

const bodyPositions: readonly EquipmentPosition[] = [
  { slot: "head", position: "head", label: "Head" },
  { slot: "necklace", position: "neck", label: "Neck" },
  {
    slot: "pauldrons",
    position: "shoulder-left",
    label: "Shoulder",
    side: "left",
  },
  {
    slot: "pauldrons",
    position: "shoulder-right",
    label: "Shoulder",
    side: "right",
  },
  { slot: "chest", position: "chest", label: "Chest" },
  { slot: "bracers", position: "arm-left", label: "Bracer", side: "left" },
  { slot: "bracers", position: "arm-right", label: "Bracer", side: "right" },
  { slot: "belt", position: "waist", label: "Belt" },
  { slot: "gloves", position: "hand-left", label: "Hand", side: "left" },
  { slot: "gloves", position: "hand-right", label: "Hand", side: "right" },
  { slot: "greaves", position: "legs", label: "Legs" },
  { slot: "boots", position: "feet", label: "Feet" },
];

const tools: readonly EquipmentPosition[] = [
  { slot: "fellingAxe", position: "fellingAxe", label: "Felling axe" },
  { slot: "pickaxe", position: "pickaxe", label: "Pickaxe" },
  { slot: "fishingRod", position: "fishingRod", label: "Fishing rod" },
  { slot: "hoe", position: "hoe", label: "Hoe" },
];

const accessories: readonly EquipmentPosition[] = [
  { slot: "amulet", position: "amulet", label: "Amulet" },
  { slot: "ring1", position: "ring1", label: "Ring I" },
  { slot: "ring2", position: "ring2", label: "Ring II" },
  { slot: "backpack", position: "backpack", label: "Backpack" },
];

/** Shared by the live equipment view and loading state to preserve the body layout. */
export function EquipmentLayout({
  renderSlot,
}: {
  renderSlot: (position: EquipmentPosition) => ReactNode;
}) {
  const cell = (position: EquipmentPosition) => (
    <div
      className="game-equipment-cell"
      data-position={position.position}
      key={position.position}
    >
      {renderSlot(position)}
      <span className="game-equipment-label">{position.label}</span>
    </div>
  );

  return (
    <div className="game-equipment-stage">
      <div
        className="game-equipment-armaments"
        role="group"
        aria-label="Weapons and tools"
      >
        <div className="game-equipment-hands">
          {cell({ slot: "weapon", position: "weapon", label: "Main hand" })}
          {cell({ slot: "offhand", position: "offhand", label: "Off hand" })}
        </div>
        <div className="game-equipment-tools">
          <h3 className="game-equipment-group-label" id="equipment-tools-label">
            Tools
          </h3>
          {/* Two tools in view; the rest scroll, so new tools never grow the panel. */}
          <div
            className="game-equipment-tool-list"
            role="group"
            aria-labelledby="equipment-tools-label"
            tabIndex={0}
          >
            {tools.map(cell)}
          </div>
        </div>
      </div>

      <div
        className="game-equipment-body"
        role="group"
        aria-label="Armor arranged on the body"
      >
        <svg
          className="game-equipment-outline"
          viewBox="0 0 300 540"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <ellipse cx="150" cy="40" rx="27" ry="34" />
          <path d="M132 73v19l-64 22c-17 6-25 19-28 38l-12 124-5 34c-2 14 18 19 23 6l12-37 21-94 23 104-8 48 16 153-13 24c-3 8 3 15 11 15h22l20-158 20 158h22c8 0 14-7 11-15l-13-24 16-153-8-48 23-104 21 94 12 37c5 13 25 8 23-6l-5-34-12-124c-3-19-11-32-28-38l-64-22V73" />
          <path d="M102 289q48 14 96 0M99 329q51 19 102 0M79 185l-11-71M221 185l11-71" />
        </svg>
        {bodyPositions.map(cell)}
      </div>

      <div
        className="game-equipment-accessories"
        role="group"
        aria-label="Jewelry and backpack"
      >
        <h3 className="game-equipment-group-label">Accessories</h3>
        {accessories.map(cell)}
      </div>
    </div>
  );
}
