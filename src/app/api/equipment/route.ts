import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "~/lib/prisma";
import { populateEquipmentSlots, validateEquipment } from "~/utils/inventory";
import { updateInventoryCapacity } from "~/utils/inventoryCapacity";
import { getServerAuthSession } from "~/server/auth";
import { EQUIPMENT_SLOTS, type EquipmentDbField } from "~/utils/itemEquipTo";
import { getEquipmentValidationError } from "~/utils/inventoryClient";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Keep departure/harvest snapshots stable and match the client-side action lock.
    const now = new Date();
    const [
      vocational,
      travel,
      gardenHarvest,
      gatheringExpedition,
      huntingExpedition,
      dungeonRun,
    ] =
      await Promise.all([
        prisma.userVocationalActivity.findUnique({
          where: { userId },
          select: { endsAt: true },
        }),
        prisma.userTravelActivity.findUnique({
          where: { userId },
          select: { endsAt: true, cancelledAt: true },
        }),
        prisma.userGardenHarvestActivity.findUnique({
          where: { userId },
          select: { id: true },
        }),
        prisma.userGatheringExpedition.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
        prisma.userHuntingExpedition.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
        prisma.userDungeonRun.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
      ]);

    const hasActiveVocational = !!vocational && vocational.endsAt > now;
    const hasActiveTravel =
      !!travel && !travel.cancelledAt && travel.endsAt > now;
    const hasActiveGardenOrGathering = Boolean(
      gardenHarvest ?? gatheringExpedition ?? huntingExpedition ?? dungeonRun,
    );
    if (hasActiveVocational || hasActiveTravel || hasActiveGardenOrGathering) {
      return NextResponse.json(
        { error: "You cannot change equipment while an action is active." },
        { status: 409 },
      );
    }
    const payload: unknown = await req.json();
    const equipment =
      payload && typeof payload === "object" && "equipment" in payload
        ? payload.equipment
        : undefined;

    if (
      !equipment ||
      typeof equipment !== "object" ||
      Array.isArray(equipment)
    ) {
      return NextResponse.json(
        { error: "Invalid request: equipment object required" },
        { status: 400 },
      );
    }

    const selection = equipment as Record<string, number | null>;
    if (!validateEquipment(selection)) {
      return NextResponse.json(
        { error: "Invalid equipment data" },
        { status: 400 },
      );
    }

    const itemIds = [
      ...new Set(
        Object.values(selection).filter(
          (id): id is number =>
            typeof id === "number" && Number.isSafeInteger(id) && id > 0,
        ),
      ),
    ];
    const [character, availableItems] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { level: true },
      }),
      prisma.userItem.findMany({
        where: {
          id: { in: itemIds },
          userId,
          status: { in: ["IN_INVENTORY", "EQUIPPED"] },
        },
        select: {
          id: true,
          itemTemplate: {
            select: {
              name: true,
              equipTo: true,
              twoHanded: true,
              requiredLevel: true,
            },
          },
        },
      }),
    ]);
    if (!character)
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 },
      );
    const equipmentError = getEquipmentValidationError(
      selection,
      availableItems.map((item) => ({ id: item.id, ...item.itemTemplate })),
      character.level,
    );
    if (equipmentError)
      return NextResponse.json({ error: equipmentError }, { status: 400 });

    const dbFields = Object.fromEntries(
      EQUIPMENT_SLOTS.map((s) => [s.dbField, selection[s.slot] ?? null]),
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
    await updateInventoryCapacity(userId);

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

export async function GET(_req: NextRequest) {
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
