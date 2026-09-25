import type { InventorySlot } from "~/utils/inventorySlots";

/**
 * Rules for rearranging what a player carries: their bag slots, their
 * equipment and the delete slot. The client proposes a new arrangement; these
 * checks make sure it is only a rearrangement. Kept free of database access
 * so the rules can be tested directly.
 */

/** No real bag comes close; anything longer is not a genuine layout. */
export const MAX_LAYOUT_SLOTS = 500;

/** The slot list a client sent, or null when it isn't one. */
export function parseSlotLayout(value: unknown): InventorySlot[] | null {
  if (!Array.isArray(value) || value.length > MAX_LAYOUT_SLOTS) return null;
  const seen = new Set<number>();
  const slots: InventorySlot[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const { slotIndex, item } = entry as { slotIndex?: unknown; item?: unknown };
    if (
      typeof slotIndex !== "number" ||
      !Number.isSafeInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= MAX_LAYOUT_SLOTS ||
      seen.has(slotIndex)
    ) {
      return null;
    }
    seen.add(slotIndex);
    if (item === null || item === undefined) {
      slots.push({ slotIndex, item: null });
      continue;
    }
    const id = typeof item === "object" ? (item as { id?: unknown }).id : undefined;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
      return null;
    }
    slots.push({ slotIndex, item: { id } });
  }
  return slots;
}

/**
 * The next layout may hold exactly what the player carries now: nothing
 * added (another player's item, something listed or in storage), nothing
 * left out (an item can't be parked outside every container to dodge the bag
 * limit and brought back later), nothing twice.
 */
export function checkConservation(
  carried: ReadonlySet<number>,
  nextIds: readonly number[],
): { ok: true } | { ok: false; reason: "duplicate" | "added" | "missing" } {
  const seen = new Set<number>();
  for (const id of nextIds) {
    if (seen.has(id)) return { ok: false, reason: "duplicate" };
    if (!carried.has(id)) return { ok: false, reason: "added" };
    seen.add(id);
  }
  if (seen.size !== carried.size) return { ok: false, reason: "missing" };
  return { ok: true };
}

/**
 * Lays items out over `capacity` slots, keeping their positions where
 * possible. Items past the end (a smaller bag) move to the first free slots.
 * When they don't all fit, `overflow` counts the leftovers; with `extend`
 * they stay in extra slots past the end instead of being dropped.
 */
export function fitSlots(
  slots: readonly InventorySlot[],
  capacity: number,
  options: { extend?: boolean } = {},
): { slots: InventorySlot[]; overflow: number } {
  const size = Math.max(0, Math.floor(capacity));
  const result: InventorySlot[] = Array.from({ length: size }, (_, slotIndex) => ({
    slotIndex,
    item: null,
  }));
  const displaced: Array<{ id: number }> = [];

  for (const slot of [...slots].sort((a, b) => a.slotIndex - b.slotIndex)) {
    if (!slot.item) continue;
    const target = result[slot.slotIndex];
    if (target && !target.item) target.item = { id: slot.item.id };
    else displaced.push({ id: slot.item.id });
  }

  let overflow = 0;
  for (const item of displaced) {
    const free = result.find((slot) => !slot.item);
    if (free) {
      free.item = item;
    } else if (options.extend) {
      result.push({ slotIndex: result.length, item });
      overflow++;
    } else {
      overflow++;
    }
  }
  return { slots: result, overflow };
}

/** Item ids in slot order (duplicates included, so callers can spot them). */
export function slotItemIds(slots: readonly InventorySlot[]): number[] {
  return slots.flatMap((slot) => (slot.item ? [slot.item.id] : []));
}
