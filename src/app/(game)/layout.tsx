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

import { GeistSans } from "geist/font/sans";
import GameHeader from "~/components/game/ui/Header";
import SidebarLeft from "~/components/game/ui/Sidebars/SidebarLeft";

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

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    include: {
      inventory: true,
    },
  });

  // Fetch equipment for global state
  const userEquipment = await prisma.equipment.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      headItemId: null,
      necklaceItemId: null,
      chestItemId: null,
      pauldronsItemId: null,
      bracersItemId: null,
      glovesItemId: null,
      greavesItemId: null,
      bootsItemId: null,
      beltItemId: null,
      ring1ItemId: null,
      ring2ItemId: null,
      amuletItemId: null,
      backpackItemId: null,
      weaponItemId: null,
    },
    update: {},
  });

  const equipmentItemIds = Object.values({
    head: userEquipment?.headItemId,
    necklace: userEquipment?.necklaceItemId,
    chest: userEquipment?.chestItemId,
    pauldrons: userEquipment?.pauldronsItemId,
    bracers: userEquipment?.bracersItemId,
    gloves: userEquipment?.glovesItemId,
    belt: userEquipment?.beltItemId,
    greaves: userEquipment?.greavesItemId,
    boots: userEquipment?.bootsItemId,
    ring1: userEquipment?.ring1ItemId,
    ring2: userEquipment?.ring2ItemId,
    amulet: userEquipment?.amuletItemId,
    backpack: userEquipment?.backpackItemId,
    weapon: userEquipment?.weaponItemId,
  }).filter((id): id is number => id !== null);

  const equipmentItems = await fetchUserItemsByIds(equipmentItemIds);
  const equipmentItemMap = new Map(
    equipmentItems.map((item) => [item.id, item]),
  );

  const initialEquipment = {
    head: userEquipment?.headItemId
      ? equipmentItemMap.get(userEquipment.headItemId) || null
      : null,
    necklace: userEquipment?.necklaceItemId
      ? equipmentItemMap.get(userEquipment.necklaceItemId) || null
      : null,
    chest: userEquipment?.chestItemId
      ? equipmentItemMap.get(userEquipment.chestItemId) || null
      : null,
    pauldrons: userEquipment?.pauldronsItemId
      ? equipmentItemMap.get(userEquipment.pauldronsItemId) || null
      : null,
    bracers: userEquipment?.bracersItemId
      ? equipmentItemMap.get(userEquipment.bracersItemId) || null
      : null,
    gloves: userEquipment?.glovesItemId
      ? equipmentItemMap.get(userEquipment.glovesItemId) || null
      : null,
    belt: userEquipment?.beltItemId
      ? equipmentItemMap.get(userEquipment.beltItemId) || null
      : null,
    greaves: userEquipment?.greavesItemId
      ? equipmentItemMap.get(userEquipment.greavesItemId) || null
      : null,
    boots: userEquipment?.bootsItemId
      ? equipmentItemMap.get(userEquipment.bootsItemId) || null
      : null,
    ring1: userEquipment?.ring1ItemId
      ? equipmentItemMap.get(userEquipment.ring1ItemId) || null
      : null,
    ring2: userEquipment?.ring2ItemId
      ? equipmentItemMap.get(userEquipment.ring2ItemId) || null
      : null,
    backpack: userEquipment?.backpackItemId
      ? equipmentItemMap.get(userEquipment.backpackItemId) || null
      : null,
    amulet: userEquipment?.amuletItemId
      ? equipmentItemMap.get(userEquipment.amuletItemId) || null
      : null,
    weapon: userEquipment?.weaponItemId
      ? equipmentItemMap.get(userEquipment.weaponItemId) || null
      : null,
  };

  // Fetch initial level data
  const initialLevelData = await getXpProgress(session.user.id);

  return (
    <html
      lang="en"
      className={`${GeistSans.variable}`}
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
                stroke-width="0"
              ></path>
            </svg>
            <rect
              width="100%"
              height="100%"
              stroke-width="0"
              fill="url(#983e3e4c-de6d-4c3f-8d64-b9761d1534cc)"
            ></rect>
          </svg>
        </div>
        <AuthSessionProvider>
          <UserContextProvider initialUser={user ?? undefined}>
            <Providers>
              <EquipmentProvider initialEquipment={initialEquipment}>
                <LevelProvider initialLevelData={initialLevelData || undefined}>
                  <GameHeader />
                  <div className="flex gap-10">
                    <div>
                      <SidebarLeft />
                    </div>
                    <div className="h-[calc(100vh-66px)] w-full overflow-y-scroll pt-10">
                      <div className="container pb-10">{children}</div>
                    </div>
                  </div>
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
