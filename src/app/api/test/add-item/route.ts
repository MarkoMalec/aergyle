import { NextRequest, NextResponse } from "next/server";
import { ItemRarity } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { grantStackableItemToInventory } from "~/server/items/grantItem";

/**
 * POST /api/test/add-item
 * Creates UserItem instance with rarity and adds to inventory
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;
    const { itemId, rarity, quantity } = body;

    const qty = Math.max(1, Math.floor(Number(quantity ?? 1)));

    if (!itemId || !rarity) {
      return NextResponse.json(
        { error: "itemId and rarity are required" },
        { status: 400 }
      );
    }

    // Validate rarity
    if (!Object.values(ItemRarity).includes(rarity)) {
      return NextResponse.json(
        { error: `Invalid rarity: ${rarity}` },
        { status: 400 }
      );
    }

    // Get item template
    const itemTemplate = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!itemTemplate) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Stacks onto existing stacks; non-stackables become one instance per slot.
    const grant = await grantStackableItemToInventory({
      db: prisma,
      userId,
      itemId,
      rarity,
      quantity: qty,
    });

    return NextResponse.json({
      success: true,
      itemName: itemTemplate.name,
      rarity,
      addedQuantity: grant.addedQuantity,
      remainingQuantity: grant.remainingQuantity,
    });
  } catch (error) {
    console.error("Error adding test item:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to add item",
      },
      { status: 500 }
    );
  }
}
