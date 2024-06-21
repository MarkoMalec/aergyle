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
import { InventorySlot } from "~/components/dnd/DnDContext";

const CharacterPage = async () => {
  const session = await getServerSession(authOptions);

  const userInventory = await prisma.inventory.findUnique({
    where: {
      userId: session?.user.id,
    },
    include: {
      User: true,
    },
  });

  const slots = userInventory?.slots as Prisma.JsonArray;

  const slotsWithItems: InventorySlot[] = await Promise.all(
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

  const userEquipment = await prisma.equipment.findUnique({
    where: {
      userId: session?.user.id,
    },
  });

  const equipmentWithItems = {
    head: userEquipment?.head ? await fetchItem(userEquipment.head) : null,
    necklace: userEquipment?.necklace
      ? await fetchItem(userEquipment.necklace)
      : null,
    chest: userEquipment?.chest ? await fetchItem(userEquipment.chest) : null,
    shoulders: userEquipment?.shoulders
      ? await fetchItem(userEquipment.shoulders)
      : null,
    arms: userEquipment?.arms ? await fetchItem(userEquipment.arms) : null,
    gloves: userEquipment?.gloves
      ? await fetchItem(userEquipment.gloves)
      : null,
    belt: userEquipment?.belt ? await fetchItem(userEquipment.belt) : null,
    legs: userEquipment?.legs ? await fetchItem(userEquipment.legs) : null,
    boots: userEquipment?.boots ? await fetchItem(userEquipment.boots) : null,
    ring1: userEquipment?.ring1 ? await fetchItem(userEquipment.ring1) : null,
    ring2: userEquipment?.ring2 ? await fetchItem(userEquipment.ring2) : null,
    backpack: userEquipment?.backpack
      ? await fetchItem(userEquipment.backpack)
      : null,
    amulet: userEquipment?.amulet
      ? await fetchItem(userEquipment.amulet)
      : null,
    weapon: userEquipment?.weapon
      ? await fetchItem(userEquipment.weapon)
      : null,
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
