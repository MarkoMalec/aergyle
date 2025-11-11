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
      shouldersItemId: null,
      armsItemId: null,
      glovesItemId: null,
      legsItemId: null,
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
    shoulders: userEquipment?.shouldersItemId,
    arms: userEquipment?.armsItemId,
    gloves: userEquipment?.glovesItemId,
    belt: userEquipment?.beltItemId,
    legs: userEquipment?.legsItemId,
    boots: userEquipment?.bootsItemId,
    ring1: userEquipment?.ring1ItemId,
    ring2: userEquipment?.ring2ItemId,
    amulet: userEquipment?.amuletItemId,
    backpack: userEquipment?.backpackItemId,
    weapon: userEquipment?.weaponItemId,
  }).filter((id): id is number => id !== null);

  const equipmentItems = await fetchUserItemsByIds(equipmentItemIds);
  const equipmentItemMap = new Map(equipmentItems.map((item) => [item.id, item]));

  const initialEquipment = {
    head: userEquipment?.headItemId ? equipmentItemMap.get(userEquipment.headItemId) || null : null,
    necklace: userEquipment?.necklaceItemId ? equipmentItemMap.get(userEquipment.necklaceItemId) || null : null,
    chest: userEquipment?.chestItemId ? equipmentItemMap.get(userEquipment.chestItemId) || null : null,
    shoulders: userEquipment?.shouldersItemId ? equipmentItemMap.get(userEquipment.shouldersItemId) || null : null,
    arms: userEquipment?.armsItemId ? equipmentItemMap.get(userEquipment.armsItemId) || null : null,
    gloves: userEquipment?.glovesItemId ? equipmentItemMap.get(userEquipment.glovesItemId) || null : null,
    belt: userEquipment?.beltItemId ? equipmentItemMap.get(userEquipment.beltItemId) || null : null,
    legs: userEquipment?.legsItemId ? equipmentItemMap.get(userEquipment.legsItemId) || null : null,
    boots: userEquipment?.bootsItemId ? equipmentItemMap.get(userEquipment.bootsItemId) || null : null,
    ring1: userEquipment?.ring1ItemId ? equipmentItemMap.get(userEquipment.ring1ItemId) || null : null,
    ring2: userEquipment?.ring2ItemId ? equipmentItemMap.get(userEquipment.ring2ItemId) || null : null,
    backpack: userEquipment?.backpackItemId ? equipmentItemMap.get(userEquipment.backpackItemId) || null : null,
    amulet: userEquipment?.amuletItemId ? equipmentItemMap.get(userEquipment.amuletItemId) || null : null,
    weapon: userEquipment?.weaponItemId ? equipmentItemMap.get(userEquipment.weaponItemId) || null : null,
  };

  // Fetch initial level data
  const initialLevelData = await getXpProgress(session.user.id);

  return (
    <html lang="en" className={`${GeistSans.variable}`} suppressHydrationWarning>
      <body>
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
