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
import { fetchItemsByIds } from "~/utils/inventory";

const CharacterPage = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("User not authenticated");
  }

  const [userInventory, userEquipment] = await Promise.all([
    prisma.inventory.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.equipment.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

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
    head: userEquipment?.head,
    necklace: userEquipment?.necklace,
    chest: userEquipment?.chest,
    shoulders: userEquipment?.shoulders,
    arms: userEquipment?.arms,
    gloves: userEquipment?.gloves,
    belt: userEquipment?.belt,
    legs: userEquipment?.legs,
    boots: userEquipment?.boots,
    ring1: userEquipment?.ring1,
    ring2: userEquipment?.ring2,
    amulet: userEquipment?.amulet,
    backpack: userEquipment?.backpack,
    weapon: userEquipment?.weapon,
  }).filter((id): id is number => id !== null);

  const allItemIds = [...inventoryItemIds, ...equipmentItemIds];
  const items = await fetchItemsByIds(allItemIds);
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const slotsWithItems: InventorySlotWithItem[] = slotStructure.map(
    ({ index, itemId }) => ({
      slotIndex: index,
      item: itemId ? itemMap.get(itemId) || null : null,
    }),
  );

  const equipmentWithItems = {
    head: userEquipment?.head ? itemMap.get(userEquipment.head) || null : null,
    necklace: userEquipment?.necklace
      ? itemMap.get(userEquipment.necklace) || null
      : null,
    chest: userEquipment?.chest
      ? itemMap.get(userEquipment.chest) || null
      : null,
    shoulders: userEquipment?.shoulders
      ? itemMap.get(userEquipment.shoulders) || null
      : null,
    arms: userEquipment?.arms ? itemMap.get(userEquipment.arms) || null : null,
    gloves: userEquipment?.gloves
      ? itemMap.get(userEquipment.gloves) || null
      : null,
    belt: userEquipment?.belt ? itemMap.get(userEquipment.belt) || null : null,
    legs: userEquipment?.legs ? itemMap.get(userEquipment.legs) || null : null,
    boots: userEquipment?.boots
      ? itemMap.get(userEquipment.boots) || null
      : null,
    ring1: userEquipment?.ring1
      ? itemMap.get(userEquipment.ring1) || null
      : null,
    ring2: userEquipment?.ring2
      ? itemMap.get(userEquipment.ring2) || null
      : null,
    backpack: userEquipment?.backpack
      ? itemMap.get(userEquipment.backpack) || null
      : null,
    amulet: userEquipment?.amulet
      ? itemMap.get(userEquipment.amulet) || null
      : null,
    weapon: userEquipment?.weapon
      ? itemMap.get(userEquipment.weapon) || null
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
          <Card className="w-full border-none bg-white/5">
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-5">
                <ul className="w-full max-w-[250px] space-y-5 text-white">
                  <ul>
                    <li className="flex items-center justify-between">
                      Minimum hit <small>[0]</small>
                    </li>
                    <li className="flex items-center justify-between">
                      Maximum hit <small>[0]</small>
                    </li>
                    <li className="flex items-center justify-between">
                      Chance to Hit <small>[0]</small>
                    </li>
                    <li className="flex items-center justify-between">
                      Accuracy <small>[0]</small>
                    </li>
                    <li className="flex items-center justify-between">
                      Damage Reduction <small>[0]</small>
                    </li>
                  </ul>
                  <ul>
                    <li className="flex items-center justify-between">
                      Evasion (Melee) <small>[0]</small>
                    </li>
                    <li className="flex items-center justify-between">
                      Evasion (Ranged) <small>[0]</small>
                    </li>
                    <li className="flex items-center justify-between">
                      Evasion (Magic) <small>[0]</small>
                    </li>
                  </ul>
                  <ul>
                    <li className="flex items-center justify-between">
                      Prayer Points <small>[0]</small>
                    </li>
                    <li className="flex items-center justify-between">
                      Active Prayers <small>[0]</small>
                    </li>
                  </ul>
                </ul>
                <Equipment />
              </div>
            </CardContent>
          </Card>
        </div>
        <Inventory />
      </DndProvider>
    </main>
  );
};

export default CharacterPage;
