import type { ItemStatus } from "~/generated/prisma/enums";
import type { InventorySlot } from "~/utils/inventorySlots";
import {
  EQUIPMENT_SLOTS,
  type EquipmentDbField,
  type EquipmentItemReferences,
} from "~/utils/itemEquipTo";
import {
  levelForTotalXp,
  xpTotalForLevel,
  type XpCurve,
} from "~/utils/xpCurve";

/**
 * Rules behind the /admin player editor, kept free of database access so they
 * can be tested directly.
 */

/** Item rows a player still has; SOLD and DELETED rows are only history. */
export const LIVE_ITEM_STATUSES = [
  "IN_INVENTORY",
  "EQUIPPED",
  "IN_STORAGE",
  "LISTED",
] as const satisfies readonly ItemStatus[];

export type ItemPlacement =
  | { kind: "BAG"; slotIndex: number }
  | { kind: "EQUIPPED"; slot: (typeof EQUIPMENT_SLOTS)[number]["slot"] }
  | { kind: "DELETE_SLOT" }
  | { kind: "STORAGE" }
  | { kind: "LISTED" }
  /** Carried, but nothing points at it, so the player can't see it. */
  | { kind: "UNPLACED" };

export type CarriedLayout = {
  slots: InventorySlot[];
  equipment: EquipmentItemReferences;
  deleteSlotId: number | null;
};

/**
 * Where one of the player's items is. Equipment wins over a bag slot, as it
 * does when the game repairs a layout that lists an item twice.
 */
export function itemPlacement(
  item: { id: number; status: ItemStatus },
  layout: CarriedLayout,
): ItemPlacement {
  if (item.status === "IN_STORAGE") return { kind: "STORAGE" };
  if (item.status === "LISTED") return { kind: "LISTED" };

  const equipped = EQUIPMENT_SLOTS.find(
    (definition) => layout.equipment[definition.dbField] === item.id,
  );
  if (equipped) return { kind: "EQUIPPED", slot: equipped.slot };
  const slot = layout.slots.find((entry) => entry.item?.id === item.id);
  if (slot) return { kind: "BAG", slotIndex: slot.slotIndex };
  if (layout.deleteSlotId === item.id) return { kind: "DELETE_SLOT" };
  return { kind: "UNPLACED" };
}

/**
 * The layout without one item: its bag slot emptied, its equipment slot and
 * the delete slot cleared. `equipment` lists only the fields that change.
 */
export function withoutItem(
  layout: CarriedLayout,
  userItemId: number,
): {
  slots: InventorySlot[];
  equipment: Partial<Record<EquipmentDbField, null>>;
  deleteSlotId: number | null;
  slotsChanged: boolean;
} {
  let slotsChanged = false;
  const slots = layout.slots.map((slot): InventorySlot => {
    if (slot.item?.id !== userItemId) return slot;
    slotsChanged = true;
    return { slotIndex: slot.slotIndex, item: null };
  });
  const equipment: Partial<Record<EquipmentDbField, null>> = {};
  for (const { dbField } of EQUIPMENT_SLOTS) {
    if (layout.equipment[dbField] === userItemId) equipment[dbField] = null;
  }
  return {
    slots,
    equipment,
    deleteSlotId:
      layout.deleteSlotId === userItemId ? null : layout.deleteSlotId,
    slotsChanged,
  };
}

/** The highest level a curve has a threshold for. */
export function maxCurveLevel(curve: XpCurve): number {
  return curve.byXp.reduce((max, row) => Math.max(max, row.level), 1);
}

/**
 * A level and total XP that agree, from an admin's edit of either one. The
 * game derives the level from total XP on every read, so a level on its own
 * would be undone: setting level N starts the player at the beginning of N.
 */
export function resolveLevelEdit(
  curve: XpCurve,
  edit: { level: number } | { experience: bigint },
): { level: number; experience: bigint } {
  if ("experience" in edit) {
    const experience = edit.experience < 0n ? 0n : edit.experience;
    return { level: levelForTotalXp(curve, experience), experience };
  }
  const top = maxCurveLevel(curve);
  if (edit.level < 1 || edit.level > top) {
    throw new Error(`Levels go from 1 to ${top}`);
  }
  return { level: edit.level, experience: xpTotalForLevel(curve, edit.level) };
}

/**
 * Moves a timed activity's window back so it ends now, keeping its length:
 * every unit, tile or encounter is then due, and the game's own settlement
 * or claim pays it out as usual.
 */
export function completedWindow(
  window: { startedAt: Date; endsAt: Date },
  now: Date,
): { startedAt: Date; endsAt: Date } {
  const remaining = Math.max(0, window.endsAt.getTime() - now.getTime());
  return {
    startedAt: new Date(window.startedAt.getTime() - remaining),
    endsAt: new Date(window.endsAt.getTime() - remaining),
  };
}
