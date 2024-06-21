import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const { userId, inventory } = await req.json();

  console.log(inventory);

  try {
    const userInventory = await prisma.inventory.update({
      where: {
        userId: userId,
      },
      data: {
        slots: inventory,
      },
    });

    return NextResponse.json({
      status: 201,
      json: {
        message: `User's inventory updated ${userInventory}`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ status: 500, error: "Internal Server Error" });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    console.log(userId, "USER ID?")
    if (!userId) {
      return NextResponse.json({
        status: 400,
        error: "Bad Request: Missing userId",
      });
    }

    const userInventory = await prisma.inventory.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!userInventory || !userInventory.slots) {
      return NextResponse.json({
        status: 404,
        error: "Inventory not found or empty",
      });
    }

    const slots = userInventory.slots as Prisma.JsonArray;

    const slotsWithItems = await Promise.all(
      slots.map(async (slot, index) => {
        if (typeof slot === "object" && slot !== null && "item" in slot) {
          const slotObj = slot as Prisma.JsonObject;
          const slotItem = slotObj.item as Prisma.JsonObject;

          if (slotItem && "id" in slotItem) {
            const item = await prisma.item.findUnique({
              where: { id: slotItem.id as number },
              select: {
                id: true,
                name: true,
                sprite: true,
                stat1: true,
                stat2: true,
                price: true,
                equipTo: true,
              },
            });
            return { slotIndex: index, item: item };
          }
        }
        return { slotIndex: index, item: null };
      }),
    );

    return NextResponse.json({
      status: 200,
      slots: slotsWithItems,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ status: 500, error: "Internal Server Error" });
  }
}

