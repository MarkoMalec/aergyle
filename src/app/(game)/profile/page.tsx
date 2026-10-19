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
import { type InventorySlotWithItem } from "~/types/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { CharacterStats } from "~/components/game/character/CharacterStats";
import { redirect } from "next/navigation";
import { getVocationalStatusDebug } from "~/server/vocations";
import { getCharacterBaseStats, getStatGrowthRules } from "~/server/stats";
import { getCharacterVitals } from "~/server/combat";
import { settleVocationalTicks } from "../settle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CharacterPage = async ({
  searchParams,
}: {
  searchParams?: { debug?: string };
}) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/play");
  }

  const debugEnabled =
    process.env.NODE_ENV !== "production" && searchParams?.debug === "1";

  // Ensure a refresh of this page reflects newly completed vocational ticks.
  // Shared with the layout, so the ticks settle once per request.
  const vocationalDebug = debugEnabled
    ? await getVocationalStatusDebug(session.user.id)
    : await settleVocationalTicks(session.user.id);

  // Parallelize all independent queries for better performance
  const [userInventory, baseStatsFromDb, vitals, growthRules] =
    await Promise.all([
      prisma.inventory.findUnique({
        where: { userId: session.user.id },
      }),
      getCharacterBaseStats(session.user.id),
      getCharacterVitals(session.user.id),
      getStatGrowthRules(),
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

  // Fetch UserItems (with rarity and stats)
  const userItems = await fetchUserItemsByIds(
    session.user.id,
    inventoryItemIds,
  );
  const itemMap = new Map(userItems.map((item) => [item.id, item]));

  const slotsWithItems: InventorySlotWithItem[] = slotStructure.map(
    ({ index, itemId }) => ({
      slotIndex: index,
      item: itemId ? itemMap.get(itemId) ?? null : null,
    }),
  );

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

      <DndProvider initialInventory={slotsWithItems}>
        <Portrait
          name={
            session.user.name?.trim().length
              ? session.user.name.trim()
              : "Wayfarer"
          }
        >
          <CharacterStats
            baseStats={baseStats}
            unarmedAttackSpeed={growthRules.ATTACK_SPEED.baseValue}
            currentHealth={vitals.currentHealth}
          />
        </Portrait>
        <div className="game-profile-dashboard">
          <Equipment />
          <Inventory />
        </div>
      </DndProvider>
    </main>
  );
};

export default CharacterPage;
