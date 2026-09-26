import React from "react";
import { prisma } from "~/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { UserContextProvider } from "~/context/userContext";
import { EquipmentProvider } from "~/context/equipmentContext";
import { LevelProvider } from "~/context/levelContext";
import Providers, { AuthSessionProvider } from "../providers";
import { loadEquipmentWithItems } from "~/utils/inventory";
import { getXpProgress } from "~/utils/leveling";
import { redirect } from "next/navigation";
import { StaleSession } from "~/components/auth/StaleSession";
import { settleVocationalTicks } from "./settle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import GameHeader from "~/components/game/ui/Header";
import SidebarLeft from "~/components/game/ui/Sidebars/SidebarLeft";
import { VocationalActiveActionProvider } from "~/components/game/actions/VocationalActiveActionProvider";
import { ActivitySummaryDialog } from "~/components/game/actions/ActivitySummaryDialog";

export const metadata = {
  title: "Aergyle Game",
  description: "Game",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const GameLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession(authOptions);

  // Redirect to sign-in if not authenticated
  if (!session?.user?.id) {
    redirect("/play");
  }

  const userId = session.user.id;
  let loaded;
  try {
    // Auto-claim any newly completed vocational ticks on page load/refresh.
    // This keeps inventory and user state consistent with the "refresh/visit" model.
    await settleVocationalTicks(userId);

    // Settling can change the inventory and XP, so the rest loads after it.
    const [user, initialEquipment, initialLevelData] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          inventory: true,
        },
      }),
      loadEquipmentWithItems(userId),
      getXpProgress(userId),
    ]);
    loaded = { user, initialEquipment, initialLevelData };
  } catch (error) {
    // A valid cookie for an account that no longer exists fails above.
    const exists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) return <StaleSession />;
    throw error;
  }
  const { user, initialEquipment, initialLevelData } = loaded;
  if (!user) return <StaleSession />;

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
                  <ActivitySummaryDialog />
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
