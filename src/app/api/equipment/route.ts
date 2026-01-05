import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { populateEquipmentSlots, validateEquipment } from "~/utils/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { updateInventoryCapacity } from "~/utils/inventoryCapacity";
import { getServerAuthSession } from "~/server/auth";
import { EQUIPMENT_SLOTS, type EquipmentDbField } from "~/utils/itemEquipTo";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Equipment changes are not allowed while any action is active (vocations or travel).
    const now = new Date();
    const [vocational, travel] = await Promise.all([
      prisma.userVocationalActivity.findUnique({
        where: { userId },
        select: { endsAt: true },
      }),
      prisma.userTravelActivity.findUnique({
        where: { userId },
        select: { endsAt: true, cancelledAt: true },
      }),
    ]);

    const hasActiveVocational = !!vocational && vocational.endsAt > now;
    const hasActiveTravel = !!travel && !travel.cancelledAt && travel.endsAt > now;
    if (hasActiveVocational || hasActiveTravel) {
      return NextResponse.json(
        { error: "You cannot change equipment while an action is active." },
        { status: 409 },
      );
    }
    const { equipment } = await req.json();

    if (!equipment || typeof equipment !== "object") {
      return NextResponse.json(
        { error: "Invalid request: equipment object required" },
        { status: 400 }
      );
    }

    if (!validateEquipment(equipment)) {
      return NextResponse.json(
        { error: "Invalid equipment data" },
        { status: 400 },
      );
    }

    const dbFields = Object.fromEntries(
      EQUIPMENT_SLOTS.map((s) => [s.dbField, equipment[s.slot] ?? null]),
    ) as Partial<Record<EquipmentDbField, number | null>>;

    const userEquipment = await prisma.equipment.upsert({
      where: { userId },
      create: {
        userId,
        ...dbFields,
      },
      update: {
        ...dbFields,
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
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const emptyDbFields = Object.fromEntries(
      EQUIPMENT_SLOTS.map((s) => [s.dbField, null]),
    );

    // Use upsert to create equipment if it doesn't exist
    const userEquipment = await prisma.equipment.upsert({
      where: { userId },
      create: {
        userId,
        ...(emptyDbFields as Partial<Record<EquipmentDbField, null>>),
      },
      update: {}, // Don't update anything, just return existing
    });

    const equipmentIds = Object.fromEntries(
      EQUIPMENT_SLOTS.map((s) => [s.slot, userEquipment[s.dbField]]),
    );

    const equipmentWithItems = await populateEquipmentSlots(equipmentIds);

    return NextResponse.json(equipmentWithItems, { status: 200 });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
