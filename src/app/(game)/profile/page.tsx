import React from "react";
import { DndProvider } from "~/components/dnd/DnDContext";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import type { Prisma } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import Inventory from "~/components/game/character/Inventory/Inventory";
import Equipment from "~/components/game/character/Equipment/Equipment";
import { type InventorySlotWithItem } from "~/types/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { CharacterHero } from "~/components/game/character/CharacterHero";
import { CharacterSheetProvider } from "~/components/game/character/CharacterSheetContext";
import { AttributeSheet } from "~/components/game/character/AttributeSheet";
import { VocationsPanel } from "~/components/game/character/VocationsPanel";
import { redirect } from "next/navigation";
import { getVocationalStatusDebug } from "~/server/vocations";
import { getCharacterBaseStats, getStatGrowthRules } from "~/server/stats";
import { getCharacterVitals } from "~/server/combat";
import { getVocationSummaries } from "~/server/skills/overview";
import { listPublicArt } from "~/server/publicAssets";
import { StatArtProvider } from "~/components/game/character/stat-display";
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
  const [
    userInventory,
    baseStats,
    vitals,
    growthRules,
    vocations,
    character,
    statArt,
  ] = await Promise.all([
    prisma.inventory.findUnique({
      where: { userId: session.user.id },
    }),
    getCharacterBaseStats(session.user.id),
    getCharacterVitals(session.user.id),
    getStatGrowthRules(),
    getVocationSummaries(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentLocation: { select: { name: true } } },
    }),
    listPublicArt("assets/stats"),
  ]);

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
      {debugEnabled ? (
        <pre className="mb-6 overflow-auto rounded-md bg-black/40 p-3 text-xs text-foreground">
          {JSON.stringify(vocationalDebug, null, 2)}
        </pre>
      ) : null}

      <DndProvider initialInventory={slotsWithItems}>
        <StatArtProvider slugs={statArt}>
          <CharacterSheetProvider
            baseStats={baseStats}
            unarmedAttackSpeed={growthRules.ATTACK_SPEED.baseValue}
          >
            <CharacterHero
              name={
                session.user.name?.trim().length
                  ? session.user.name.trim()
                  : "Wayfarer"
              }
              location={character?.currentLocation?.name ?? null}
              initialHealth={vitals.currentHealth}
            />
            {/*
              Two columns from xl (1280px): equipment over vocations, inventory
              over attributes. Below that the columns dissolve (display:
              contents) and `order` keeps equipment, inventory, attributes,
              vocations.
            */}
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(420px,540px)_minmax(508px,1fr)]">
              <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
                <div className="order-1 min-w-0">
                  <Equipment />
                </div>
                <VocationsPanel skills={vocations} className="order-4" />
              </div>
              <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
                <div className="order-2 min-w-0">
                  <Inventory />
                </div>
                <AttributeSheet className="order-3" />
              </div>
            </div>
          </CharacterSheetProvider>
        </StatArtProvider>
      </DndProvider>
    </main>
  );
};

export default CharacterPage;
