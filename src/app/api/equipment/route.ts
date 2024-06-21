import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: NextRequest) {
  const { userId, equipment } = await req.json();

  // Ensure the data structure matches your Equipment model in Prisma
  const equipmentData = {
    head: equipment.head,
    necklace: equipment.necklace,
    chest: equipment.chest,
    shoulders: equipment.shoulders,
    arms: equipment.arms,
    gloves: equipment.gloves,
    legs: equipment.legs,
    boots: equipment.boots,
    belt: equipment.belt,
    ring1: equipment.ring1,
    ring2: equipment.ring2,
    amulet: equipment.amulet,
    backpack: equipment.backpack,
    weapon: equipment.weapon,
  };

  try {
    // Assuming your Equipment model is associated with the User model via userId
    const userEquipment = await prisma.equipment.update({
      where: {
        userId: userId,
      },
      data: equipmentData,
    });

    return NextResponse.json({
      status: 201,
      json: {
        message: `User's equipment updated`,
        userEquipment,
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
    if (!userId) {
      return NextResponse.json({
        status: 400,
        error: "Bad Request: Missing userId",
      });
    }

    const userEquipment = await prisma.equipment.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!userEquipment) {
      return NextResponse.json({
        status: 404,
        error: "Equipment not found",
      });
    }

    const equipmentWithItems = {
      head: userEquipment.head ? await fetchItem(userEquipment.head) : null,
      necklace: userEquipment.necklace
        ? await fetchItem(userEquipment.necklace)
        : null,
      chest: userEquipment.chest ? await fetchItem(userEquipment.chest) : null,
      shoulders: userEquipment.shoulders
        ? await fetchItem(userEquipment.shoulders)
        : null,
      arms: userEquipment.arms ? await fetchItem(userEquipment.arms) : null,
      gloves: userEquipment.gloves ? await fetchItem(userEquipment.gloves) : null,
      belt: userEquipment.belt ? await fetchItem(userEquipment.belt) : null,
      legs: userEquipment.legs ? await fetchItem(userEquipment.legs) : null,
      boots: userEquipment.boots ? await fetchItem(userEquipment.boots) : null,
      ring1: userEquipment.ring1 ? await fetchItem(userEquipment.ring1) : null,
      ring2: userEquipment.ring2 ? await fetchItem(userEquipment.ring2) : null,
      backpack: userEquipment.backpack
        ? await fetchItem(userEquipment.backpack)
        : null,
      amulet: userEquipment.amulet ? await fetchItem(userEquipment.amulet) : null,
      weapon: userEquipment.weapon ? await fetchItem(userEquipment.weapon) : null,
    };

    async function fetchItem(itemId: number) {
      return await prisma.item.findUnique({
        where: { id: itemId },
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
    }

    return NextResponse.json(equipmentWithItems);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    return NextResponse.json({ status: 500, error: "Internal Server Error" });
  }
}