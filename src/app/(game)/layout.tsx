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
import { EQUIPMENT_SLOTS, type EquipmentDbField } from "~/utils/itemEquipTo";
import { EquipmentSlotsWithItems } from "~/types/inventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { GeistSans } from "geist/font/sans";
import { Inter } from "next/font/google";
import GameHeader from "~/components/game/ui/Header";
import SidebarLeft from "~/components/game/ui/Sidebars/SidebarLeft";
import { VocationalActiveActionProvider } from "~/components/game/actions/VocationalActiveActionProvider";
import { ActionCompletionDialog } from "~/components/game/actions/ActionCompletionDialog";

export const metadata = {
  title: "Aergyle Game",
  description: "Game",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

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

  const equipmentItemIds = EQUIPMENT_SLOTS.map(
    (s) => userEquipment[s.dbField] as number | null,
  ).filter((id): id is number => id !== null);

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
    <html
      lang="en"
      className={`${inter.className}`}
      suppressHydrationWarning
    >
      <body>
        <div id="background-pattern-root">
          <svg
            className="background-pattern background-pattern--visible absolute inset-0 -z-10 hidden h-full w-full stroke-white/10 [mask-image:radial-gradient(100%_100%_at_top_left,white,transparent)] md:block"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="983e3e4c-de6d-4c3f-8d64-b9761d1534cc"
                width="180"
                height="180"
                x="50%"
                y="-1"
                patternUnits="userSpaceOnUse"
              >
                <path d="M.5 200V.5H200" fill="none"></path>
              </pattern>
            </defs>
            <svg x="50%" y="-1" className="overflow-visible fill-gray-800/20">
              <path
                d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
                strokeWidth="0"
              ></path>
            </svg>
            <rect
              width="100%"
              height="100%"
              strokeWidth="0"
              fill="url(#983e3e4c-de6d-4c3f-8d64-b9761d1534cc)"
            ></rect>
          </svg>
        </div>
        <AuthSessionProvider session={session}>
          <UserContextProvider initialUser={user ?? undefined}>
            <Providers>
              <EquipmentProvider initialEquipment={initialEquipment}>
                <LevelProvider initialLevelData={initialLevelData || undefined}>
                  <VocationalActiveActionProvider>
                    <ActionCompletionDialog completions={vocationalStatus.completionSummaries} />
                    <div className="flex gap-10">
                      <div>
                        <SidebarLeft />
                      </div>
                      <div className="min-h-screen w-full">
                        <div className="container pb-10">
                          <div className="pl-72">
                          <GameHeader />
                          {children}
                          </div>
                        </div>
                      </div>
                    </div>
                  </VocationalActiveActionProvider>
                </LevelProvider>
              </EquipmentProvider>
            </Providers>
          </UserContextProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
};

export default GameLayout;
