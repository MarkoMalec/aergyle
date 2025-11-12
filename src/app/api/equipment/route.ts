import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { populateEquipmentSlots, validateEquipment } from "~/utils/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { updateInventoryCapacity } from "~/utils/inventoryCapacity";

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

    const userEquipment = await prisma.equipment.upsert({
      where: { userId },
      create: {
        userId,
        headItemId: equipment.head,
        necklaceItemId: equipment.necklace,
        chestItemId: equipment.chest,
        shouldersItemId: equipment.shoulders,
        armsItemId: equipment.arms,
        glovesItemId: equipment.gloves,
        legsItemId: equipment.legs,
        bootsItemId: equipment.boots,
        beltItemId: equipment.belt,
        ring1ItemId: equipment.ring1,
        ring2ItemId: equipment.ring2,
        amuletItemId: equipment.amulet,
        backpackItemId: equipment.backpack,
        weaponItemId: equipment.weapon,
      },
      update: {
        headItemId: equipment.head,
        necklaceItemId: equipment.necklace,
        chestItemId: equipment.chest,
        shouldersItemId: equipment.shoulders,
        armsItemId: equipment.arms,
        glovesItemId: equipment.gloves,
        legsItemId: equipment.legs,
        bootsItemId: equipment.boots,
        beltItemId: equipment.belt,
        ring1ItemId: equipment.ring1,
        ring2ItemId: equipment.ring2,
        amuletItemId: equipment.amulet,
        backpackItemId: equipment.backpack,
        weaponItemId: equipment.weapon,
      },
    });

    // Recalculate inventory capacity (in case backpack or CARRYING_CAPACITY items changed)
    const newCapacity = await updateInventoryCapacity(userId);

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

    // Use upsert to create equipment if it doesn't exist
    const userEquipment = await prisma.equipment.upsert({
      where: { userId },
      create: {
        userId,
        headItemId: null,
        necklaceItemId: null,
        chestItemId: null,
        shouldersItemId: null,
        armsItemId: null,
        glovesItemId: null,
        legsItemId: null,
        bootsItemId: null,
        beltItemId: null,
        ring1ItemId: null,
        ring2ItemId: null,
        amuletItemId: null,
        backpackItemId: null,
        weaponItemId: null,
      },
      update: {}, // Don't update anything, just return existing
    });

    const equipmentWithItems = await populateEquipmentSlots({
      head: userEquipment.headItemId,
      necklace: userEquipment.necklaceItemId,
      chest: userEquipment.chestItemId,
      shoulders: userEquipment.shouldersItemId,
      arms: userEquipment.armsItemId,
      gloves: userEquipment.glovesItemId,
      belt: userEquipment.beltItemId,
      legs: userEquipment.legsItemId,
      boots: userEquipment.bootsItemId,
      ring1: userEquipment.ring1ItemId,
      ring2: userEquipment.ring2ItemId,
      backpack: userEquipment.backpackItemId,
      amulet: userEquipment.amuletItemId,
      weapon: userEquipment.weaponItemId,
    });

    return NextResponse.json(equipmentWithItems, { status: 200 });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
