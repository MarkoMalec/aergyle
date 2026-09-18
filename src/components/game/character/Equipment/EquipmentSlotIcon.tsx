import type { EquipmentSlotKey } from "~/utils/itemEquipTo";

const paths: Record<EquipmentSlotKey, string> = {
  head: "M5 20V10a7 7 0 0 1 14 0v10l-5-2v-5h-4v5l-5 2ZM5 11h5m4 0h5M12 3v5",
  necklace: "M4 4c0 7 2 12 8 16 6-4 8-9 8-16M9 17l3-3 3 3-3 4-3-4Z",
  pauldrons: "M3 16v-4c0-5 4-8 9-8s9 3 9 8v4l-9 4-9-4ZM3 12l9 4 9-4",
  chest: "m8 3-5 3 2 6 3-1-1 10h10l-1-10 3 1 2-6-5-3c-1 3-7 3-8 0Z",
  bracers: "m7 3 10 2 1 15-11 1L5 6l2-3Zm-1 5 11 2M7 16l11-2",
  gloves:
    "M8 21v-4l-4-6c-1-2 1-3 2-2l2 2V5c0-2 3-2 3 0v5-7c0-2 3-2 3 0v7-5c0-2 3-2 3 0v6-3c0-2 3-2 3 0v6l-3 4v3H8Zm0-4h9",
  belt: "M3 8h18v8H3V8Zm6-2h6v12H9V6Zm3 6h5",
  greaves: "M5 3h14l1 7-3 11h-5l1-11h-2l1 11H7L4 10l1-7Zm0 5h14",
  boots: "M7 3h10l-1 11 5 3v4H4v-7l3-2V3Zm0 5h10M4 18h17",
  ring1: "m9 3 3-2 3 2-3 4-3-4Zm-1 4a7 7 0 1 0 8 0M9 10a4 4 0 1 0 6 0",
  ring2: "m9 3 3-2 3 2-3 4-3-4Zm-1 4a7 7 0 1 0 8 0M9 10a4 4 0 1 0 6 0",
  amulet:
    "M8 3c0 3 2 5 4 6 2-1 4-3 4-6M12 8l7 6-7 8-7-8 7-6Zm0 4 3 3-3 4-3-4 3-3Z",
  backpack:
    "M8 5V3h8v2M5 11V8c0-4 14-4 14 0v3M5 11h14l1 10H4l1-10Zm0 0 7 4 7-4M10 15v3h4v-3",
  weapon: "m14 3 7-1-1 7L9 18l-3-3L14 3Zm-9 9 7 7M8 16l-5 5m-1-3 4 4",
  fellingAxe: "m4 22 13-18M10 5l3-3c2 3 5 5 9 5l-2 7c-5-1-8-4-10-9Z",
  pickaxe: "M4 22 15 6M4 6C10 0 19 2 22 13L12 7 4 6Z",
};

export function EquipmentSlotIcon({ slot }: { slot: EquipmentSlotKey }) {
  return (
    <svg
      className="game-equipment-empty-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[slot]} />
    </svg>
  );
}
