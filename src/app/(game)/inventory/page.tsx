import React from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { DndProvider } from "~/components/dnd/DnDContext";
import Inventory from "~/components/game/character/Inventory/Inventory";
import Equipment from "~/components/game/character/Equipment/Equipment";
import { CharacterSheetProvider } from "~/components/game/character/CharacterSheetContext";
import { AttributeSheet } from "~/components/game/character/AttributeSheet";
import { StatArtProvider } from "~/components/game/character/stat-display";
import PageHeading from "~/components/game/ui/PageHeading";
import { Button } from "~/components/ui/button";
import type { Prisma } from "~/generated/prisma/client";
import { playerProfileHref } from "~/game/players";
import { prisma } from "~/lib/prisma";
import { authOptions } from "~/server/auth";
import { listPublicArt } from "~/server/publicAssets";
import { getCharacterBaseStats, getStatGrowthRules } from "~/server/stats";
import { getVocationalStatusDebug } from "~/server/vocations";
import { type InventorySlotWithItem } from "~/types/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { settleVocationalTicks } from "../settle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Inventory · Aergyle" };

/**
 * The character's gear: equipment and bag with drag and drop, and the live
 * attribute sheet beside the bag so every swap shows what it changes. The
 * character itself (hero, vocations, activity) is the public profile, /@Name.
 */
const InventoryPage = async ({
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

  const [userInventory, baseStats, growthRules, character, statArt] =
    await Promise.all([
      prisma.inventory.findUnique({
        where: { userId: session.user.id },
      }),
      getCharacterBaseStats(session.user.id),
      getStatGrowthRules(),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      }),
      listPublicArt("assets/stats"),
    ]);

  const slots = (userInventory?.slots as Prisma.JsonArray) ?? [];

  const inventoryItemIds: number[] = [];
  const slotStructure: { index: number; itemId: number | null }[] = [];

  slots.forEach((slot, index) => {
    if (typeof slot === "object" && slot !== null && "item" in slot) {
      const slotItem = slot.item as Prisma.JsonObject;
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

      <PageHeading eyebrow="Character" title="Inventory">
        {character?.name ? (
          <Button asChild variant="soft" size="sm">
            <Link href={playerProfileHref(character.name)}>
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              Profile
            </Link>
          </Button>
        ) : null}
      </PageHeading>

      <DndProvider initialInventory={slotsWithItems}>
        <StatArtProvider slugs={statArt}>
          <CharacterSheetProvider
            baseStats={baseStats}
            unarmedAttackSpeed={growthRules.ATTACK_SPEED.baseValue}
          >
            {/*
              From xl (1280px) equipment stays in view on the left (below the
              76px top bar, on screens tall enough to show all of it) while
              the bag and the attribute sheet scroll beside it, so every swap
              shows what it changes. Below that: equipment, inventory,
              attributes.
            */}
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(420px,540px)_minmax(508px,1fr)]">
              <div className="min-w-0 xl:[@media(min-height:900px)]:sticky xl:[@media(min-height:900px)]:top-[96px]">
                <Equipment />
              </div>
              <div className="flex min-w-0 flex-col gap-5">
                <Inventory />
                <AttributeSheet />
              </div>
            </div>
          </CharacterSheetProvider>
        </StatArtProvider>
      </DndProvider>
    </main>
  );
};

export default InventoryPage;
