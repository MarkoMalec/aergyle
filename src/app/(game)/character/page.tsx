"use server";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DndProvider } from "~/components/dnd/DnDContext";
import Portrait from "~/components/game/character/Portrait";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "~/lib/prisma";
import Inventory from "~/components/game/character/Inventory/Inventory";
import Equipment from "~/components/game/character/Equipment/Equipment";
import { InventorySlotWithItem } from "~/types/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { CharacterStats } from "~/components/game/character/CharacterStats";
import { AddItemTestForm } from "~/components/forms/AddItemTestForm";
import { redirect } from "next/navigation";

const CharacterPage = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/signin");
  }

  const [userInventory, userEquipment] = await Promise.all([
    prisma.inventory.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.equipment.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
      },
      update: {},
    }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { level: true },
  });

  // Fetch character base stats
  const baseStatsFromDb = await prisma.characterBaseStat.findMany({
    where: { userId: session.user.id },
  });

  // Convert to array format for CharacterStats component
  const baseStats = baseStatsFromDb.map((stat) => ({
    statType: stat.statType,
    value: stat.value,
  }));

  const slots = (userInventory?.slots as Prisma.JsonArray) || [];

  const inventoryItemIds: number[] = [];
  const slotStructure: { index: number; itemId: number | null }[] = [];

  slots.forEach((slot, index) => {
    if (typeof slot === "object" && slot !== null && "item" in slot) {
      const slotObj = slot as Prisma.JsonObject;
      const slotItem = slotObj.item as Prisma.JsonObject;
      if (slotItem && "id" in slotItem) {
        const itemId = slotItem.id as number;
        inventoryItemIds.push(itemId);
        slotStructure.push({ index, itemId });
      } else {
        slotStructure.push({ index, itemId: null });
      }
    } else {
      slotStructure.push({ index, itemId: null });
    }
  });

  const equipmentItemIds = Object.values({
    head: userEquipment?.headItemId,
    necklace: userEquipment?.necklaceItemId,
    chest: userEquipment?.chestItemId,
    shoulders: userEquipment?.shouldersItemId,
    arms: userEquipment?.armsItemId,
    gloves: userEquipment?.glovesItemId,
    belt: userEquipment?.beltItemId,
    legs: userEquipment?.legsItemId,
    boots: userEquipment?.bootsItemId,
    ring1: userEquipment?.ring1ItemId,
    ring2: userEquipment?.ring2ItemId,
    amulet: userEquipment?.amuletItemId,
    backpack: userEquipment?.backpackItemId,
    weapon: userEquipment?.weaponItemId,
  }).filter((id): id is number => id !== null);

  const allItemIds = [...inventoryItemIds, ...equipmentItemIds];
  
  // Fetch UserItems (with rarity and stats)
  const userItems = await fetchUserItemsByIds(allItemIds);
  const itemMap = new Map(userItems.map((item) => [item.id, item]));

  // Get all items for test form
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      name: true,
      equipTo: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const slotsWithItems: InventorySlotWithItem[] = slotStructure.map(
    ({ index, itemId }) => ({
      slotIndex: index,
      item: itemId ? itemMap.get(itemId) || null : null,
    }),
  );

  const equipmentWithItems = {
    head: userEquipment?.headItemId ? itemMap.get(userEquipment.headItemId) || null : null,
    necklace: userEquipment?.necklaceItemId
      ? itemMap.get(userEquipment.necklaceItemId) || null
      : null,
    chest: userEquipment?.chestItemId
      ? itemMap.get(userEquipment.chestItemId) || null
      : null,
    shoulders: userEquipment?.shouldersItemId
      ? itemMap.get(userEquipment.shouldersItemId) || null
      : null,
    arms: userEquipment?.armsItemId ? itemMap.get(userEquipment.armsItemId) || null : null,
    gloves: userEquipment?.glovesItemId
      ? itemMap.get(userEquipment.glovesItemId) || null
      : null,
    belt: userEquipment?.beltItemId ? itemMap.get(userEquipment.beltItemId) || null : null,
    legs: userEquipment?.legsItemId ? itemMap.get(userEquipment.legsItemId) || null : null,
    boots: userEquipment?.bootsItemId
      ? itemMap.get(userEquipment.bootsItemId) || null
      : null,
    ring1: userEquipment?.ring1ItemId
      ? itemMap.get(userEquipment.ring1ItemId) || null
      : null,
    ring2: userEquipment?.ring2ItemId
      ? itemMap.get(userEquipment.ring2ItemId) || null
      : null,
    backpack: userEquipment?.backpackItemId
      ? itemMap.get(userEquipment.backpackItemId) || null
      : null,
    amulet: userEquipment?.amuletItemId
      ? itemMap.get(userEquipment.amuletItemId) || null
      : null,
    weapon: userEquipment?.weaponItemId
      ? itemMap.get(userEquipment.weaponItemId) || null
      : null,
  };

  return (
    <main>
      <h1 className="mb-12 text-center text-5xl font-bold text-black text-white">
        Character
      </h1>
      
      <DndProvider
        initialEquipment={equipmentWithItems}
        initialInventory={slotsWithItems}
      >
        <div className="mb-10 flex gap-10">
          <Portrait />
          <div className="flex w-full gap-5">
            <Equipment />
          </div>
        </div>
        <Inventory />
        <CharacterStats baseStats={baseStats} />
      </DndProvider>
      
      {/* Test Form */}
      <div className="my-8 flex gap-4">
        <AddItemTestForm userId={session.user.id} items={allItems} />
      </div>
    </main>
  );
};

export default CharacterPage;
