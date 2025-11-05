import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { Prisma } from "@prisma/client";
import { fetchItemsByIds } from "~/utils/inventory";

export async function POST(req: NextRequest) {
  try {
    const { userId, inventory } = await req.json();

    if (!userId || !inventory || !Array.isArray(inventory)) {
      return NextResponse.json(
        { error: "Invalid request: userId and inventory array required" },
        { status: 400 },
      );
    }

    const userInventory = await prisma.inventory.update({
      where: { userId },
      data: { slots: inventory },
    });

    return NextResponse.json(
      {
        message: "Inventory updated successfully",
        inventory: userInventory,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Bad Request: Missing userId" },
        { status: 400 },
      );
    }

    const userInventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (!userInventory || !userInventory.slots) {
      return NextResponse.json(
        { error: "Inventory not found or empty" },
        { status: 404 },
      );
    }

    const slots = userInventory.slots as Prisma.JsonArray;

    const itemIds: number[] = [];
    const slotStructure: { index: number; itemId: number | null }[] = [];

    slots.forEach((slot, index) => {
      if (typeof slot === "object" && slot !== null && "item" in slot) {
        const slotObj = slot as Prisma.JsonObject;
        const slotItem = slotObj.item as Prisma.JsonObject;
        if (slotItem && "id" in slotItem) {
          const itemId = slotItem.id as number;
          itemIds.push(itemId);
          slotStructure.push({ index, itemId });
        } else {
          slotStructure.push({ index, itemId: null });
        }
      } else {
        slotStructure.push({ index, itemId: null });
      }
    });

    const items = await fetchItemsByIds(itemIds);
    const itemMap = new Map(items.map((item) => [item.id, item]));

    const slotsWithItems = slotStructure.map(({ index, itemId }) => ({
      slotIndex: index,
      item: itemId ? itemMap.get(itemId) || null : null,
    }));

    console.log("user inventory: ", slotsWithItems[0]);

    return NextResponse.json({ slots: slotsWithItems }, { status: 200 });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
