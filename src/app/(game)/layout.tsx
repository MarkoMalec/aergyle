import React from "react";
import { prisma } from "~/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { UserContextProvider } from "~/context/userContext";
import Providers from "../providers";

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

  const user = await prisma.user.findUnique({
    where: {
      id: session?.user.id,
    },
    include: {
      inventory: true,
    },
  });

  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <UserContextProvider initialUser={user ?? undefined}>
          <Providers>
            <GameHeader />
            <div className="flex gap-10">
              <div>
                <SidebarLeft />
              </div>
              <div className="h-[calc(100vh-66px)] w-full overflow-y-scroll pt-10">
                <div className="container">{children}</div>
              </div>
            </div>
          </Providers>
        </UserContextProvider>
      </body>
    </html>
  );
};

export default GameLayout;
