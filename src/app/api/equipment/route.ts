import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { populateEquipmentSlots, validateEquipment } from "~/utils/inventory";

export async function POST(req: NextRequest) {
  try {
    const { userId, equipment } = await req.json();

    if (!userId || !equipment || typeof equipment !== "object") {
      return NextResponse.json(
        { error: "Invalid request: userId and equipment object required" },
        { status: 400 },
      );
    }

    if (!validateEquipment(equipment)) {
      return NextResponse.json(
        { error: "Invalid equipment data" },
        { status: 400 },
      );
    }

    const userEquipment = await prisma.equipment.update({
      where: { userId },
      data: {
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
      },
    });

    return NextResponse.json(
      {
        message: "Equipment updated successfully",
        equipment: userEquipment,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating equipment:", error);
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

    const userEquipment = await prisma.equipment.findUnique({
      where: { userId },
    });

    if (!userEquipment) {
      return NextResponse.json(
        { error: "Equipment not found" },
        { status: 404 },
      );
    }

    const equipmentWithItems = await populateEquipmentSlots({
      head: userEquipment.head,
      necklace: userEquipment.necklace,
      chest: userEquipment.chest,
      shoulders: userEquipment.shoulders,
      arms: userEquipment.arms,
      gloves: userEquipment.gloves,
      belt: userEquipment.belt,
      legs: userEquipment.legs,
      boots: userEquipment.boots,
      ring1: userEquipment.ring1,
      ring2: userEquipment.ring2,
      backpack: userEquipment.backpack,
      amulet: userEquipment.amulet,
      weapon: userEquipment.weapon,
    });

    console.log("Fetched equipment with items: ", equipmentWithItems);

    return NextResponse.json(equipmentWithItems, { status: 200 });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
