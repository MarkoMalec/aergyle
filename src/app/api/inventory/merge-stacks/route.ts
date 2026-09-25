import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { prisma } from "~/lib/prisma";
import { lockInventory } from "~/server/items/inventoryLock";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";

type HttpError = Error & { status?: number };
function fail(status: number, message: string): never {
  const error = new Error(message) as HttpError;
  error.status = status;
  throw error;
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Pours one inventory stack into another of the same item and rarity. */
export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => null)) as {
    sourceUserItemId?: unknown;
    targetUserItemId?: unknown;
  } | null;
  const sourceId = body?.sourceUserItemId;
  const targetId = body?.targetUserItemId;
  if (!isId(sourceId) || !isId(targetId) || sourceId === targetId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const inventory = await lockInventory(tx, userId);
      if (!inventory) fail(404, "Inventory not found");
      const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
      if (
        !slots.some((slot) => slot.item?.id === sourceId) ||
        !slots.some((slot) => slot.item?.id === targetId)
      ) {
        fail(409, "Both stacks must be in your inventory");
      }

      const stacks = await tx.userItem.findMany({
        where: {
          id: { in: [sourceId, targetId] },
          userId,
          status: "IN_INVENTORY",
        },
        select: {
          id: true,
          itemId: true,
          rarity: true,
          quantity: true,
          itemTemplate: { select: { stackable: true, maxStackSize: true } },
        },
      });
      const source = stacks.find((stack) => stack.id === sourceId);
      const target = stacks.find((stack) => stack.id === targetId);
      if (!source || !target) fail(404, "Item not found");
      if (source.itemId !== target.itemId || source.rarity !== target.rarity) {
        fail(400, "Items cannot be stacked together");
      }
      if (!source.itemTemplate.stackable) fail(400, "Item is not stackable");

      const maxStackSize = Math.max(1, source.itemTemplate.maxStackSize);
      const total = source.quantity + target.quantity;
      const targetQuantity = Math.min(total, maxStackSize);
      const remainder = total - targetQuantity;

      // Each write applies only if the stack still holds what was read.
      const wroteTarget = await tx.userItem.updateMany({
        where: { id: target.id, quantity: target.quantity },
        data: { quantity: targetQuantity },
      });
      const wroteSource =
        remainder > 0
          ? await tx.userItem.updateMany({
              where: { id: source.id, quantity: source.quantity },
              data: { quantity: remainder },
            })
          : await tx.userItem.deleteMany({
              where: { id: source.id, quantity: source.quantity },
            });
      if (wroteTarget.count !== 1 || wroteSource.count !== 1) {
        fail(409, "Your inventory changed. Please try again.");
      }

      if (remainder === 0) {
        await tx.inventory.update({
          where: { userId },
          data: {
            slots: slotsToInputJson(
              slots.map((slot) =>
                slot.item?.id === source.id ? { ...slot, item: null } : slot,
              ),
            ),
          },
        });
      }

      return {
        merged: true,
        targetQuantity,
        ...(remainder > 0 ? { sourceQuantity: remainder } : {}),
        sourceDeleted: remainder === 0,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const status = (error as HttpError).status;
    if (typeof status === "number") {
      return NextResponse.json({ error: (error as Error).message }, { status });
    }
    console.error("Error merging stacks:", error);
    return NextResponse.json(
      { error: "Failed to merge stacks" },
      { status: 500 },
    );
  }
}
