import { ItemType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { removeFromStack } from "~/server/items/consumeItems";
import { normalizeInventorySlots } from "~/utils/inventorySlots";

export async function getLearnedRecipes(userId: string) {
  return prisma.userLearnedRecipe.findMany({
    where: { userId, recipeItem: { itemType: ItemType.RECIPE } },
    select: {
      recipeItemId: true,
      learnedAt: true,
      recipeItem: { select: { name: true, sprite: true, rarity: true } },
    },
    orderBy: [{ learnedAt: "desc" }],
  });
}

export async function learnRecipeFromInventory(params: {
  userId: string;
  userItemId: number;
}) {
  const { userId, userItemId } = params;

  return prisma.$transaction(async (tx) => {
    const [userItem, inventory] = await Promise.all([
      tx.userItem.findFirst({
        where: { id: userItemId, userId, status: "IN_INVENTORY" },
        select: {
          id: true,
          itemId: true,
          quantity: true,
          itemTemplate: {
            select: { name: true, itemType: true },
          },
        },
      }),
      tx.inventory.findUnique({
        where: { userId },
        select: { maxSlots: true, slots: true },
      }),
    ]);

    if (!userItem || !inventory) {
      throw new Error("Recipe was not found in your inventory");
    }

    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    if (!slots.some((slot) => slot.item?.id === userItem.id)) {
      throw new Error("Recipe was not found in your inventory");
    }

    if (userItem.itemTemplate.itemType !== ItemType.RECIPE) {
      throw new Error("This item is not a learnable recipe");
    }

    const alreadyLearned = await tx.userLearnedRecipe.findUnique({
      where: {
        userId_recipeItemId: {
          userId,
          recipeItemId: userItem.itemId,
        },
      },
      select: { id: true },
    });

    if (alreadyLearned) {
      throw new Error("You have already learned this recipe");
    }

    const unlockedCrafts = await tx.vocationalResource.findMany({
      where: {
        requiredRecipeItemId: userItem.itemId,
      },
      select: { id: true, name: true, actionType: true },
      orderBy: [
        { actionType: "asc" },
        { requiredSkillLevel: "asc" },
        { id: "asc" },
      ],
    });

    await tx.userLearnedRecipe.create({
      data: {
        userId,
        recipeItemId: userItem.itemId,
      },
    });

    await removeFromStack({
      db: tx,
      userId,
      userItemId: userItem.id,
      quantity: 1,
    });

    return {
      recipeItemId: userItem.itemId,
      recipeName: userItem.itemTemplate.name,
      // Keep the old response key so existing Cooking clients remain compatible.
      unlockedDishes: unlockedCrafts,
      unlockedCrafts,
    };
  });
}
