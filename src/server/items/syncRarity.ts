import type { ItemRarity } from "~/generated/prisma/enums";
import type { Prisma } from "~/generated/prisma/client";

/**
 * Rarity belongs to the item: after its rarity changes, every copy (bag,
 * equipped, storage, listed), every buy order and the market history follow,
 * since the market groups by item and rarity.
 */
export async function syncItemRarity(
  db: Pick<
    Prisma.TransactionClient,
    "userItem" | "marketBuyOrder" | "marketTransaction"
  >,
  itemId: number,
  rarity: ItemRarity,
) {
  const where = { itemId, rarity: { not: rarity } };
  const data = { rarity };
  await db.userItem.updateMany({ where, data });
  await db.marketBuyOrder.updateMany({ where, data });
  await db.marketTransaction.updateMany({ where, data });
}
