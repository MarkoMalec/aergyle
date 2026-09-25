import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "~/lib/prisma";
import type { Equipment } from "~/generated/prisma/client";
import { getServerAuthSession } from "~/server/auth";
import { getActivityRows } from "~/server/activity";
import {
  checkConservation,
  fitSlots,
  parseSlotLayout,
  slotItemIds,
} from "~/server/items/inventoryLayout";
import { lockInventory } from "~/server/items/inventoryLock";
import { calculateInventoryCapacity } from "~/utils/inventoryCapacity";
import { getEquipmentValidationError } from "~/utils/inventoryClient";
import {
  normalizeInventorySlots,
  slotsToInputJson,
  type InventorySlot,
} from "~/utils/inventorySlots";
import {
  EQUIPMENT_SLOTS,
  getEquippedUserItemIds,
  type EquipmentDbField,
  type EquipmentSlotKey,
} from "~/utils/itemEquipTo";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_CAPACITY = 25;
const CHANGED =
  "Your inventory changed while you were moving things. It has been refreshed; please try again.";

type HttpError = Error & { status?: number };
function fail(status: number, message: string): never {
  const error = new Error(message) as HttpError;
  error.status = status;
  throw error;
}

type EquipmentBySlot = Record<EquipmentSlotKey, number | null>;

function equipmentBySlot(row: Equipment | null): EquipmentBySlot {
  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot.slot, row?.[slot.dbField] ?? null]),
  ) as EquipmentBySlot;
}

function toEquipmentRow(equipment: EquipmentBySlot) {
  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot.dbField, equipment[slot.slot]]),
  ) as Record<EquipmentDbField, number | null>;
}

/** The equipment a client sent, or null when it isn't a valid one. */
function parseEquipment(value: unknown): EquipmentBySlot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = equipmentBySlot(null);
  for (const [slot, id] of Object.entries(value)) {
    if (!EQUIPMENT_SLOTS.some((definition) => definition.slot === slot)) {
      return null;
    }
    if (id === null) continue;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
      return null;
    }
    result[slot as EquipmentSlotKey] = id;
  }
  return result;
}

function equippedIds(equipment: EquipmentBySlot) {
  return Object.values(equipment).filter((id): id is number => id !== null);
}

/**
 * Saves a rearrangement of what the player carries: bag slots, and optionally
 * equipment and the delete slot, in one request so a move between them can
 * never leave an item in two places or in none. The server checks it is only
 * a rearrangement: the same items, each once, all the player's own.
 */
export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => null)) as {
    inventory?: unknown;
    equipment?: unknown;
    deleteSlotId?: unknown;
  } | null;
  const slots = parseSlotLayout(body?.inventory);
  if (!slots) {
    return NextResponse.json(
      { error: "Invalid inventory layout" },
      { status: 400 },
    );
  }
  const proposedEquipment =
    body?.equipment === undefined ? undefined : parseEquipment(body.equipment);
  if (proposedEquipment === null) {
    return NextResponse.json({ error: "Invalid equipment" }, { status: 400 });
  }
  const rawDelete = body?.deleteSlotId;
  if (
    rawDelete !== undefined &&
    rawDelete !== null &&
    !(typeof rawDelete === "number" && Number.isSafeInteger(rawDelete) && rawDelete > 0)
  ) {
    return NextResponse.json({ error: "Invalid delete slot" }, { status: 400 });
  }

  try {
    // Looked up before the transaction so it never waits on a second
    // connection while holding the inventory lock. Only the player's own
    // usable items count towards capacity, so a forged equipment set can't
    // inflate it; the transaction then checks the set itself.
    const [capacity, activity] = await Promise.all([
      calculateInventoryCapacity(
        userId,
        proposedEquipment ? { equipment: toEquipmentRow(proposedEquipment) } : {},
      ),
      proposedEquipment ? getActivityRows(userId) : null,
    ]);

    await prisma.$transaction(async (tx) => {
      const inventory = await lockInventory(tx, userId);
      if (!inventory) fail(404, "Inventory not found");
      const [equipmentRow, character] = await Promise.all([
        tx.equipment.findUnique({ where: { userId } }),
        tx.user.findUnique({ where: { id: userId }, select: { level: true } }),
      ]);

      const currentEquipment = equipmentBySlot(equipmentRow);
      const nextDelete =
        rawDelete === undefined ? inventory.deleteSlotId : rawDelete;
      const storedSlots = normalizeInventorySlots(inventory.slots, null);
      const currentIds = [
        ...slotItemIds(storedSlots),
        ...equippedIds(currentEquipment),
        ...(inventory.deleteSlotId ? [inventory.deleteSlotId] : []),
      ];

      const rows = await tx.userItem.findMany({
        where: {
          id: {
            in: [
              ...new Set([
                ...currentIds,
                ...slotItemIds(slots),
                ...(proposedEquipment ? equippedIds(proposedEquipment) : []),
                ...(nextDelete ? [nextDelete] : []),
              ]),
            ],
          },
          userId,
          status: { in: ["IN_INVENTORY", "EQUIPPED"] },
        },
        select: {
          id: true,
          itemTemplate: {
            select: {
              name: true,
              equipTo: true,
              twoHanded: true,
              requiredLevel: true,
            },
          },
        },
      });
      const live = new Set(rows.map((row) => row.id));

      // A slot pointing at an item that is gone (sold, deleted) counts as
      // empty, so clearing it is not an equipment change.
      const liveEquipment = Object.fromEntries(
        EQUIPMENT_SLOTS.map(({ slot }) => {
          const id = currentEquipment[slot];
          return [slot, id !== null && live.has(id) ? id : null];
        }),
      ) as EquipmentBySlot;
      const nextEquipment = proposedEquipment ?? liveEquipment;
      const equipmentChanged = EQUIPMENT_SLOTS.some(
        ({ slot }) => liveEquipment[slot] !== nextEquipment[slot],
      );

      const nextIds = [
        ...slotItemIds(slots),
        ...equippedIds(nextEquipment),
        ...(nextDelete ? [nextDelete] : []),
      ];
      const carried = new Set(currentIds.filter((id) => live.has(id)));
      if (!checkConservation(carried, nextIds).ok) fail(409, CHANGED);

      if (equipmentChanged) {
        const now = new Date();
        const { vocation, travel, garden, gathering, hunting, dungeon } =
          activity ?? {};
        const busy =
          (!!vocation && vocation.endsAt > now) ||
          (!!travel && !travel.cancelledAt && travel.endsAt > now) ||
          Boolean(garden ?? gathering ?? hunting ?? dungeon);
        if (busy) {
          fail(409, "You cannot change equipment while an action is active.");
        }
        const problem = getEquipmentValidationError(
          nextEquipment,
          rows.map((row) => ({ id: row.id, ...row.itemTemplate })),
          character?.level ?? 1,
        );
        if (problem) fail(400, problem);
      }

      const nextEquipmentRow = toEquipmentRow(nextEquipment);
      // A bag already over its limit (say a carrying bonus ran out) may keep
      // its extra slots until they empty; a new equipment set may not create them.
      const limit = equipmentChanged
        ? capacity
        : Math.max(capacity, inventory.maxSlots);
      const fitted = fitSlots(slots, limit);
      if (fitted.overflow > 0) {
        fail(
          409,
          `Not enough room in your bags: free ${fitted.overflow} slot${fitted.overflow === 1 ? "" : "s"} first.`,
        );
      }
      const saved = fitted.slots;
      while (saved.length > capacity && !saved[saved.length - 1]?.item) {
        saved.pop();
      }

      await tx.inventory.update({
        where: { userId },
        data: {
          slots: slotsToInputJson(saved),
          deleteSlotId: nextDelete,
          maxSlots: saved.length,
        },
      });
      if (equipmentChanged) {
        await tx.equipment.upsert({
          where: { userId },
          create: { userId, ...nextEquipmentRow },
          update: nextEquipmentRow,
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = (error as HttpError).status;
    if (typeof status === "number") {
      return NextResponse.json({ error: (error as Error).message }, { status });
    }
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

function sameSlots(a: readonly InventorySlot[], b: readonly InventorySlot[]) {
  return (
    a.length === b.length &&
    a.every(
      (slot, index) =>
        slot.slotIndex === b[index]?.slotIndex &&
        (slot.item?.id ?? null) === (b[index]?.item?.id ?? null),
    )
  );
}

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const [inventory, equipment, capacity] = await Promise.all([
      prisma.inventory.findUnique({ where: { userId } }),
      prisma.equipment.findUnique({ where: { userId } }),
      calculateInventoryCapacity(userId),
    ]);
    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory not found or empty" },
        { status: 404 },
      );
    }

    const storedSlots = normalizeInventorySlots(inventory.slots, null);
    const items = await fetchUserItemsByIds(userId, [
      ...new Set([
        ...slotItemIds(storedSlots),
        ...(inventory.deleteSlotId ? [inventory.deleteSlotId] : []),
      ]),
    ]);
    const itemsById = new Map(items.map((item) => [item.id, item]));

    // Repair the layout: every item the player owns shows up once, equipment
    // first; references to items that are gone (sold, listed, stored) drop out.
    const placed = new Set(getEquippedUserItemIds(equipment));
    const healedSlots = storedSlots.map((slot): InventorySlot => {
      const id = slot.item?.id;
      if (!id || !itemsById.has(id) || placed.has(id)) {
        return { slotIndex: slot.slotIndex, item: null };
      }
      placed.add(id);
      return slot;
    });
    const deleteSlotId =
      inventory.deleteSlotId &&
      itemsById.has(inventory.deleteSlotId) &&
      !placed.has(inventory.deleteSlotId)
        ? inventory.deleteSlotId
        : null;

    // Fit the bag to its current size; items that no longer fit keep extra
    // slots past the end rather than disappearing.
    const fitted = fitSlots(healedSlots, capacity, { extend: true }).slots;

    if (
      deleteSlotId !== inventory.deleteSlotId ||
      fitted.length !== inventory.maxSlots ||
      !sameSlots(fitted, storedSlots)
    ) {
      await prisma.$transaction(async (tx) => {
        const locked = await lockInventory(tx, userId);
        // Changed since it was read (a reward landed, a move saved): leave it,
        // the next read repairs whatever is left.
        if (
          !locked ||
          locked.deleteSlotId !== inventory.deleteSlotId ||
          !sameSlots(normalizeInventorySlots(locked.slots, null), storedSlots)
        ) {
          return;
        }
        await tx.inventory.update({
          where: { userId },
          data: {
            slots: slotsToInputJson(fitted),
            deleteSlotId,
            maxSlots: fitted.length,
          },
        });
      });
    }

    return NextResponse.json(
      {
        slots: fitted.map((slot) => ({
          slotIndex: slot.slotIndex,
          item: slot.item ? itemsById.get(slot.item.id) ?? null : null,
        })),
        deleteSlot: {
          slotIndex: 999,
          item: deleteSlotId ? itemsById.get(deleteSlotId) ?? null : null,
        },
        capacity: {
          current: fitted.filter((slot) => slot.item).length,
          max: capacity,
          base: BASE_CAPACITY,
          bonus: capacity - BASE_CAPACITY,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
