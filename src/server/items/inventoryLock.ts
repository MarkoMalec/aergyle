import type { PrismaClient } from "~/generated/prisma/client";

type RawDb = Pick<PrismaClient, "$queryRaw">;

export type LockedInventory = {
  slots: unknown;
  maxSlots: number;
  deleteSlotId: number | null;
};

/**
 * Reads the player's inventory row and holds it until the surrounding
 * transaction ends. Every request that rewrites the slot layout goes through
 * here first, so two of them can't each save their own version of the same
 * layout (the later one would silently drop the other's items). A locking read
 * also returns the latest committed row, never an older snapshot of it.
 */
export async function lockInventory(
  db: RawDb,
  userId: string,
): Promise<LockedInventory | null> {
  const rows = await db.$queryRaw<
    Array<{
      slots: unknown;
      maxSlots: number | bigint;
      deleteSlotId: number | bigint | null;
    }>
  >`SELECT slots, maxSlots, deleteSlotId FROM Inventory WHERE userId = ${userId} FOR UPDATE`;
  const row = rows[0];
  if (!row) return null;
  return {
    // MariaDB stores JSON as text, which raw queries hand back unparsed.
    slots: typeof row.slots === "string" ? (JSON.parse(row.slots) as unknown) : row.slots,
    maxSlots: Number(row.maxSlots),
    deleteSlotId: row.deleteSlotId == null ? null : Number(row.deleteSlotId),
  };
}
