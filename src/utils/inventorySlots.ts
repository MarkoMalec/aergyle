import type { Prisma } from "~/generated/prisma/client";

export type InventorySlot = {
  slotIndex: number;
  item: { id: number } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseItemRef(value: unknown): { id: number } | null {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  const id = value.id;
  return typeof id === "number" && Number.isFinite(id) ? { id } : null;
}

function parseSlot(value: unknown): InventorySlot | null {
  if (!isRecord(value)) return null;

  const slotIndex = value.slotIndex;
  if (typeof slotIndex !== "number" || !Number.isFinite(slotIndex) || slotIndex < 0) {
    return null;
  }

  const item = parseItemRef(value.item);
  if (value.item !== null && item === null) {
    return null;
  }

  return { slotIndex: Math.floor(slotIndex), item };
}

export function normalizeInventorySlots(
  value: unknown,
  maxSlots: number | null | undefined,
): InventorySlot[] {
  const parsedSlots: InventorySlot[] = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      const slot = parseSlot(entry);
      if (slot) parsedSlots.push(slot);
    }
  }

  const inferredSize =
    parsedSlots.length === 0
      ? 0
      : Math.max(...parsedSlots.map((s) => s.slotIndex)) + 1;

  const size =
    typeof maxSlots === "number" && Number.isFinite(maxSlots) && maxSlots > 0
      ? Math.floor(maxSlots)
      : inferredSize;

  if (size <= 0) {
    return [];
  }

  const result: InventorySlot[] = Array.from({ length: size }, (_, index) => ({
    slotIndex: index,
    item: null,
  }));

  for (const slot of parsedSlots) {
    if (slot.slotIndex >= 0 && slot.slotIndex < size) {
      result[slot.slotIndex] = slot;
    }
  }

  return result;
}

export function slotsToInputJson(slots: InventorySlot[]): Prisma.InputJsonValue {
  return slots as unknown as Prisma.InputJsonValue;
}
