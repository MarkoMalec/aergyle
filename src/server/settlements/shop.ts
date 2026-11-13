import "server-only";

import {
  formatGold,
  MARKET_MAX_GOLD_AMOUNT,
  roundGold,
} from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import { removeFromStack } from "~/server/items/consumeItems";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import { assertPresentAt, liveOfferWhere, visibleNpcWhere } from "./access";
import { getSettlementEffects } from "./projects";

const MAX_PURCHASE_QUANTITY = 10_000;

/** Buys an NPC offer at the NPC's price; the item comes at its own rarity. */
export async function buyNpcOffer(params: {
  userId: string;
  offerId: number;
  quantity: number;
}) {
  const { userId, offerId, quantity } = params;
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_PURCHASE_QUANTITY
  ) {
    throw new Error("Choose a valid quantity");
  }

  const offer = await prisma.npcOffer.findFirst({
    where: {
      id: offerId,
      ...liveOfferWhere(new Date()),
      npc: visibleNpcWhere(),
    },
    select: {
      price: true,
      itemId: true,
      item: { select: { name: true, rarity: true } },
      npc: {
        select: {
          settlement: {
            select: { id: true, location: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!offer?.npc.settlement) throw new Error("That item is no longer for sale");
  await assertPresentAt(userId, offer.npc.settlement.location);

  const effects = await getSettlementEffects(offer.npc.settlement.id);
  const total = roundGold(
    shopPrice(Number(offer.price), effects.SHOP_DISCOUNT) * quantity,
  );
  if (total > MARKET_MAX_GOLD_AMOUNT) {
    throw new Error("That purchase is too large. Choose a smaller quantity.");
  }

  await prisma.$transaction(async (tx) => {
    const debit = await tx.user.updateMany({
      where: { id: userId, gold: { gte: total } },
      data: { gold: { decrement: total } },
    });
    if (debit.count !== 1) {
      throw new Error(`You need ${formatGold(total)} gold for this purchase`);
    }
    const grant = await grantStackableItemToInventory({
      db: tx,
      userId,
      itemId: offer.itemId,
      quantity,
    });
    if (grant.remainingQuantity > 0) {
      throw new Error("Make room in your inventory first");
    }
  });

  return { itemName: offer.item.name, quantity, total };
}

/**
 * What every NPC pays for one of an item: its base price, the value shown on
 * the item card, whatever its rarity.
 */
export function npcBuyPrice(itemPrice: number, sellBonusPercent = 0) {
  return roundGold(Math.max(0, itemPrice) * (1 + sellBonusPercent / 100));
}

/** A shop price after the settlement's community project discount. */
export function shopPrice(price: number, discountPercent: number) {
  return roundGold(price * (1 - discountPercent / 100));
}

/** Sells part or all of an inventory stack to any NPC at the item's value. */
export async function sellToNpc(params: {
  userId: string;
  npcId: number;
  userItemId: number;
  quantity: number;
}) {
  const { userId, npcId, userItemId, quantity } = params;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose a valid quantity");
  }

  const npc = await prisma.npc.findFirst({
    where: { id: npcId, ...visibleNpcWhere() },
    select: {
      settlement: {
        select: { id: true, location: { select: { id: true, name: true } } },
      },
    },
  });
  if (!npc?.settlement) throw new Error("There is no one here to sell to");
  await assertPresentAt(userId, npc.settlement.location);

  const stack = await prisma.userItem.findFirst({
    where: { id: userItemId, userId, status: "IN_INVENTORY" },
    select: { itemTemplate: { select: { name: true, price: true } } },
  });
  if (!stack) throw new Error("That item is not in your inventory");
  const effects = await getSettlementEffects(npc.settlement.id);
  const total = roundGold(
    npcBuyPrice(stack.itemTemplate.price, effects.SELL_BONUS) * quantity,
  );

  await prisma.$transaction(async (tx) => {
    await removeFromStack({ db: tx, userId, userItemId, quantity });
    if (total > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { gold: { increment: total } },
      });
    }
  });

  return { itemName: stack.itemTemplate.name, quantity, total };
}
