import React from "react";
import PageHeading from "~/components/game/ui/PageHeading";
import { DndProvider } from "~/components/dnd/DnDContext";
import Portrait from "~/components/game/character/Portrait";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import type { Prisma } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import Inventory from "~/components/game/character/Inventory/Inventory";
import Equipment from "~/components/game/character/Equipment/Equipment";
import {
  type EquipmentSlotsWithItems,
  type InventorySlotWithItem,
} from "~/types/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { CharacterStats } from "~/components/game/character/CharacterStats";
import { AddItemTestForm } from "~/components/forms/AddItemTestForm";
import { redirect } from "next/navigation";
import {
  getVocationalStatus,
  getVocationalStatusDebug,
} from "~/server/vocations";
import { getCharacterBaseStats } from "~/server/stats";
import { getCharacterVitals } from "~/server/combat";
import { ChevronDown, FlaskConical } from "lucide-react";
import { EQUIPMENT_SLOTS, getEquippedUserItemIds } from "~/utils/itemEquipTo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CharacterPage = async ({
  searchParams,
}: {
  searchParams?: { debug?: string };
}) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/signin");
  }

  const debugEnabled =
    process.env.NODE_ENV !== "production" && searchParams?.debug === "1";

  // Ensure a refresh of this page reflects newly completed vocational ticks.
  const vocationalDebug = debugEnabled
    ? await getVocationalStatusDebug(session.user.id)
    : await getVocationalStatus(session.user.id);

  // Parallelize all independent queries for better performance
  const [userInventory, userEquipment, baseStatsFromDb, allItems, vitals] =
    await Promise.all([
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
      getCharacterBaseStats(session.user.id),
      prisma.item.findMany({
        select: {
          id: true,
          name: true,
          sprite: true,
          rarity: true,
          itemType: true,
          equipTo: true,
          stackable: true,
          maxStackSize: true,
          requiredLevel: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      getCharacterVitals(session.user.id),
    ]);

  // Convert to array format for CharacterStats component
  const baseStats = Object.entries(baseStatsFromDb).map(
    ([statType, value]) => ({
      statType: statType as keyof typeof baseStatsFromDb,
      value,
    }),
  );

  const slots = (userInventory?.slots as Prisma.JsonArray) ?? [];

  const inventoryItemIds: number[] = [];
  const slotStructure: { index: number; itemId: number | null }[] = [];

  slots.forEach((slot, index) => {
    if (typeof slot === "object" && slot !== null && "item" in slot) {
      const slotObj = slot;
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

  const equipmentItemIds = getEquippedUserItemIds(userEquipment);

  const allItemIds = [...inventoryItemIds, ...equipmentItemIds];

  // Fetch UserItems (with rarity and stats)
  const userItems = await fetchUserItemsByIds(allItemIds);
  const itemMap = new Map(userItems.map((item) => [item.id, item]));

  const slotsWithItems: InventorySlotWithItem[] = slotStructure.map(
    ({ index, itemId }) => ({
      slotIndex: index,
      item: itemId ? itemMap.get(itemId) ?? null : null,
    }),
  );

  const equipmentWithItems = EQUIPMENT_SLOTS.reduce((result, definition) => {
    const userItemId = userEquipment[definition.dbField];
    result[definition.slot] = userItemId
      ? itemMap.get(userItemId) ?? null
      : null;
    return result;
  }, {} as EquipmentSlotsWithItems);

  return (
    <main>
      <PageHeading
        eyebrow="Your chronicle"
        title="Character"
        description="Prepare your kit. Tend your skills. Make your way through Aergyle."
      />

      {debugEnabled ? (
        <pre className="mb-6 overflow-auto rounded-md bg-black/40 p-3 text-xs text-foreground">
          {JSON.stringify(vocationalDebug, null, 2)}
        </pre>
      ) : null}

      <DndProvider
        initialEquipment={equipmentWithItems}
        initialInventory={slotsWithItems}
      >
        <Portrait
          name={
            session.user.name?.trim().length
              ? session.user.name.trim()
              : "Wayfarer"
          }
        >
          <CharacterStats
            baseStats={baseStats}
            currentHealth={vitals.currentHealth}
          />
        </Portrait>
        <div className="game-profile-dashboard">
          <Equipment />
          <Inventory />
        </div>
      </DndProvider>

      <details className="game-panel group my-8 overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 transition-colors hover:bg-secondary/30 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-base font-semibold text-foreground">
                Development tools
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Search the item catalog and grant test inventory
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Open console</span>
            <ChevronDown
              className="h-4 w-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>
        <div className="border-t border-border">
          <AddItemTestForm items={allItems} />
        </div>
      </details>
    </main>
  );
};

export default CharacterPage;
