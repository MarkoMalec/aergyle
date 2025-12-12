import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

/**
 * Buy an item from the marketplace
 * POST /api/marketplace/buy
 * 
 * Body: {
 *   buyerId: string,
 *   userItemId: number,
 *   quantity?: number (defaults to full quantity available)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { buyerId, userItemId, quantity: requestedQuantity } = await req.json();

    if (!buyerId || !userItemId) {
      return NextResponse.json(
        { error: "Missing required fields: buyerId, userItemId" },
        { status: 400 }
      );
    }

    // Get the listed item
    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: {
        itemTemplate: true,
        stats: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!userItem) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Check if item is listed
    if (userItem.status !== "LISTED") {
      return NextResponse.json(
        { error: "This item is not listed on the marketplace" },
        { status: 400 }
      );
    }

    // Check if buyer is not the seller
    if (userItem.userId === buyerId) {
      return NextResponse.json(
        { error: "You cannot buy your own item" },
        { status: 400 }
      );
    }

    // Determine quantity to buy
    const availableQuantity = userItem.quantity || 1;
    const quantityToBuy = requestedQuantity && requestedQuantity > 0
      ? Math.min(requestedQuantity, availableQuantity)
      : availableQuantity;

    if (quantityToBuy < 1) {
      return NextResponse.json(
        { error: "Invalid quantity" },
        { status: 400 }
      );
    }

    if (quantityToBuy > availableQuantity) {
      return NextResponse.json(
        { error: `Only ${availableQuantity} available` },
        { status: 400 }
      );
    }

    const pricePerItem = userItem.listedPrice || 0;
    const totalPrice = pricePerItem * quantityToBuy;
    const sellerId = userItem.userId;

    // Get buyer to check gold balance
    const buyer = await prisma.user.findUnique({
      where: { id: buyerId },
      select: { id: true, gold: true },
    });

    if (!buyer) {
      return NextResponse.json(
        { error: "Buyer not found" },
        { status: 404 }
      );
    }

    // Check if buyer has enough gold
    const buyerGold = parseFloat(buyer.gold.toString());
    if (buyerGold < totalPrice) {
      return NextResponse.json(
        { error: `Insufficient gold. You need ${totalPrice.toFixed(2)} gold but only have ${buyerGold.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Get buyer's inventory
    const buyerInventory = await prisma.inventory.findUnique({
      where: { userId: buyerId },
    });

    if (!buyerInventory) {
      return NextResponse.json(
        { error: "Buyer inventory not found" },
        { status: 404 }
      );
    }

    // Check if buyer has space in inventory
    const slots = buyerInventory.slots as any[];
    const emptySlotIndex = slots.findIndex(slot => slot.item === null);

    if (emptySlotIndex === -1) {
      return NextResponse.json(
        { error: "Your inventory is full" },
        { status: 400 }
      );
    }

    const isBuyingFullQuantity = quantityToBuy === availableQuantity;
    let newUserItemId: number | null = null;
    let updatedSlots = slots;

    // Execute transaction based on whether buying full or partial quantity
    if (isBuyingFullQuantity) {
      // Transfer the entire item to buyer
      updatedSlots = slots.map((slot, index) => {
        if (index === emptySlotIndex) {
          return { ...slot, item: { id: userItemId } };
        }
        return slot;
      });

      const [updatedItem] = await prisma.$transaction([
        // Transfer item to buyer
        prisma.userItem.update({
          where: { id: userItemId },
          data: {
            userId: buyerId,
            status: "IN_INVENTORY",
            listedPrice: null,
            listedAt: null,
          },
          include: {
            itemTemplate: true,
            stats: true,
          },
        }),
        // Update buyer's inventory
        prisma.inventory.update({
          where: { userId: buyerId },
          data: { slots: updatedSlots },
        }),
        // Deduct gold from buyer
        prisma.user.update({
          where: { id: buyerId },
          data: { gold: { decrement: totalPrice } },
        }),
        // Add gold to seller
        prisma.user.update({
          where: { id: sellerId },
          data: { gold: { increment: totalPrice } },
        }),
      ]);

      console.log(`[Marketplace] ${quantityToBuy}x ${userItem.itemTemplate.name} sold from ${userItem.user.name} to buyer ${buyerId} for ${totalPrice} gold`);
    } else {
      // Partial purchase: create new item for buyer, reduce seller's quantity
      const result = await prisma.$transaction(async (tx) => {
        // Create new item for buyer with purchased quantity
        const newItem = await tx.userItem.create({
          data: {
            userId: buyerId,
            itemId: userItem.itemId,
            rarity: userItem.rarity,
            quantity: quantityToBuy,
            status: "IN_INVENTORY",
            stats: {
              create: userItem.stats.map((stat) => ({
                statType: stat.statType,
                value: stat.value,
              })),
            },
          },
          include: {
            itemTemplate: true,
            stats: true,
          },
        });

        newUserItemId = newItem.id;

        // Update seller's item quantity
        await tx.userItem.update({
          where: { id: userItemId },
          data: {
            quantity: availableQuantity - quantityToBuy,
          },
        });

        // Update buyer's inventory with new item
        const updatedSlotsForPartial = slots.map((slot, index) => {
          if (index === emptySlotIndex) {
            return { ...slot, item: { id: newItem.id } };
          }
          return slot;
        });

        await tx.inventory.update({
          where: { userId: buyerId },
          data: { slots: updatedSlotsForPartial },
        });

        // Deduct gold from buyer
        await tx.user.update({
          where: { id: buyerId },
          data: { gold: { decrement: totalPrice } },
        });

        // Add gold to seller
        await tx.user.update({
          where: { id: sellerId },
          data: { gold: { increment: totalPrice } },
        });

        return newItem;
      });

      console.log(`[Marketplace] ${quantityToBuy}x ${userItem.itemTemplate.name} (partial) sold from ${userItem.user.name} to buyer ${buyerId} for ${totalPrice} gold`);
    }

    const finalItemId = isBuyingFullQuantity ? userItemId : newUserItemId;

    return NextResponse.json({
      success: true,
      message: `Purchased ${quantityToBuy}x ${userItem.itemTemplate.name} for ${totalPrice} gold`,
      itemId: finalItemId,
      quantity: quantityToBuy,
      seller: userItem.user.name,
      totalPrice,
    });

  } catch (error) {
    console.error("Error buying item:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
