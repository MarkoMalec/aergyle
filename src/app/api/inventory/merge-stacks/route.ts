import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { prisma } from "~/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sourceUserItemId, targetUserItemId } = body;

    if (!sourceUserItemId || !targetUserItemId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Optimized: Single transaction with minimal queries
    const result = await prisma.$transaction(async (tx) => {
      // Get both items WITHOUT the heavy itemTemplate include
      // We'll get the item template separately only if needed
      const [sourceItem, targetItem] = await Promise.all([
        tx.userItem.findUnique({
          where: { id: sourceUserItemId },
          select: {
            id: true,
            userId: true,
            itemId: true,
            rarity: true,
            quantity: true,
          },
        }),
        tx.userItem.findUnique({
          where: { id: targetUserItemId },
          select: {
            id: true,
            userId: true,
            itemId: true,
            rarity: true,
            quantity: true,
          },
        }),
      ]);

      if (!sourceItem || !targetItem) {
        throw new Error("Item not found");
      }

      // Verify ownership
      if (sourceItem.userId !== session.user.id || targetItem.userId !== session.user.id) {
        throw new Error("Unauthorized");
      }

      // Verify items can stack together (same itemId and rarity)
      if (
        sourceItem.itemId !== targetItem.itemId ||
        sourceItem.rarity !== targetItem.rarity
      ) {
        throw new Error("Items cannot be stacked together");
      }

      // Only fetch item template now that we know we need it
      const itemTemplate = await tx.item.findUnique({
        where: { id: sourceItem.itemId },
        select: { stackable: true, maxStackSize: true },
      });

      if (!itemTemplate?.stackable) {
        throw new Error("Item is not stackable");
      }

      const totalQuantity = sourceItem.quantity + targetItem.quantity;
      const maxStackSize = itemTemplate.maxStackSize;

      if (totalQuantity <= maxStackSize) {
        // Full merge: Update target and delete source in parallel
        await Promise.all([
          tx.userItem.update({
            where: { id: targetUserItemId },
            data: { quantity: totalQuantity },
          }),
          tx.userItem.delete({
            where: { id: sourceUserItemId },
          }),
        ]);

        return {
          merged: true,
          targetQuantity: totalQuantity,
          sourceDeleted: true,
        };
      } else {
        // Partial merge: Update both quantities in parallel
        const remainder = totalQuantity - maxStackSize;

        await Promise.all([
          tx.userItem.update({
            where: { id: targetUserItemId },
            data: { quantity: maxStackSize },
          }),
          tx.userItem.update({
            where: { id: sourceUserItemId },
            data: { quantity: remainder },
          }),
        ]);

        return {
          merged: true,
          targetQuantity: maxStackSize,
          sourceQuantity: remainder,
          sourceDeleted: false,
        };
      }
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error merging stacks:", error);
    return NextResponse.json(
      { error: "Failed to merge stacks" },
      { status: 500 }
    );
  }
}
