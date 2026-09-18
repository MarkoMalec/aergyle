import React from "react";
import { prisma } from "~/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { UserContextProvider } from "~/context/userContext";
import { EquipmentProvider } from "~/context/equipmentContext";
import { LevelProvider } from "~/context/levelContext";
import Providers, { AuthSessionProvider } from "../providers";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { getXpProgress } from "~/utils/leveling";
import { redirect } from "next/navigation";
import { getVocationalStatus } from "~/server/vocations";
import {
  EQUIPMENT_SLOTS,
  getEquippedUserItemIds,
  type EquipmentDbField,
} from "~/utils/itemEquipTo";
import { EquipmentSlotsWithItems } from "~/types/inventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import GameHeader from "~/components/game/ui/Header";
import SidebarLeft from "~/components/game/ui/Sidebars/SidebarLeft";
import { VocationalActiveActionProvider } from "~/components/game/actions/VocationalActiveActionProvider";
import { ActionCompletionDialog } from "~/components/game/actions/ActionCompletionDialog";

export const metadata = {
  title: "Aergyle Game",
  description: "Game",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const GameLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession(authOptions);

  // Redirect to sign-in if not authenticated
  if (!session?.user?.id) {
    redirect("/signin");
  }

  // Auto-claim any newly completed vocational ticks on page load/refresh.
  // This keeps inventory and user state consistent with the "refresh/visit" model.
  const vocationalStatus = await getVocationalStatus(session.user.id);

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    include: {
      inventory: true,
    },
  });

  // Fetch equipment for global state
  const emptyDbFields = Object.fromEntries(
    EQUIPMENT_SLOTS.map((s) => [s.dbField, null]),
  ) as Partial<Record<EquipmentDbField, null>>;

  const userEquipment = await prisma.equipment.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      ...emptyDbFields,
    },
    update: {},
  });

  const equipmentItemIds = getEquippedUserItemIds(userEquipment);

  const equipmentItems = await fetchUserItemsByIds(equipmentItemIds);
  const equipmentItemMap = new Map(
    equipmentItems.map((item) => [item.id, item]),
  );

  const initialEquipment = EQUIPMENT_SLOTS.reduce((acc, s) => {
    const userItemId = userEquipment[s.dbField] as number | null;
    acc[s.slot] = userItemId ? equipmentItemMap.get(userItemId) || null : null;
    return acc;
  }, {} as EquipmentSlotsWithItems);

  // Fetch initial level data
  const initialLevelData = await getXpProgress(session.user.id);

  return (
    <div className="game-shell">
      <a href="#game-content" className="game-skip-link">
        Skip to game content
      </a>
      <AuthSessionProvider session={session}>
        <UserContextProvider initialUser={user ?? undefined}>
          <Providers>
            <EquipmentProvider initialEquipment={initialEquipment}>
              <LevelProvider initialLevelData={initialLevelData || undefined}>
                <VocationalActiveActionProvider>
                  <ActionCompletionDialog
                    completions={vocationalStatus.completionSummaries}
                  />
                  <SidebarLeft />
                  <div className="game-content">
                    <GameHeader />
                    <div
                      id="game-content"
                      tabIndex={-1}
                      className="min-w-0 outline-none"
                    >
                      {children}
                    </div>
                  </div>
                </VocationalActiveActionProvider>
              </LevelProvider>
            </EquipmentProvider>
          </Providers>
        </UserContextProvider>
      </AuthSessionProvider>
    </div>
  );
};

export default GameLayout;
