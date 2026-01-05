import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import TravelLocationDialog from "~/components/game/map/TravelLocationDialog";
import { getTravelStatus } from "~/server/travel/service";
import Image from "next/image";
import { Badge } from "~/components/ui/badge";
import DragScrollContainer from "~/components/game/map/DragScrollContainer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MapPage = async () => {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const ticks = Array.from({ length: 23 }, (_, i) => (i + 1) * 10);
  const tickWrapClass = "flex items-center gap-1";
  const tickLabelClass = "text-[10px]";

  const [locations, user] = await Promise.all([
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: [{ id: "asc" }],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentLocationId: true },
    }),
  ]);

  const travelStatus = await getTravelStatus(session.user.id);
  const isTraveling = !!travelStatus.travel;

  return (
    <main className="">
      <div>
        <h1 className="text-2xl font-semibold">Map</h1>
        <p className="text-sm text-white/70">Choose a location to travel to.</p>
      </div>

      <TravelLocationDialog
        locations={locations}
        currentLocationId={user?.currentLocationId ?? null}
        travelActive={isTraveling}
      />
      <div className="ml-3 mt-5 flex items-center justify-between opacity-40">
        {ticks.map((tick) => (
          <span key={tick} className={tickWrapClass}>
            <span className={tickLabelClass}>{tick}</span>
            <span>|</span>
          </span>
        ))}
      </div>
      <div className="flex gap-0">
        <div className="-mt-2 flex flex-col justify-between opacity-40">
          {ticks.map((tick) => (
            <span key={tick} className={`${tickWrapClass} rotate-90`}>
              <span className={tickLabelClass}>{tick}</span>
              <span>|</span>
            </span>
          ))}
        </div>
        <DragScrollContainer className="h-[824px] rounded-2xl">
          <div className="relative">
            <Image
              src="/assets/world/world-map-v1.png"
              alt="World Map"
              width={2000}
              height={800}
              className="h-full w-[2000px] max-w-[1500px]"
            />
            <div className="location-markers absolute inset-0 text-center text-sm">
              <a href="#" className="absolute left-[590px] top-[480px] block">
                <div className="relative left-1/2 isolate mb-2 h-8 w-8 -translate-x-1/2"></div>
                <div className="rounded-lg bg-gray-800/50 px-3 py-1">
                  <span>Citadel</span>
                  <Badge className="mx-auto ml-2 block w-fit bg-gray-700/60">
                    ~
                  </Badge>
                </div>
              </a>

              <a href="#" className="absolute left-[700px] top-[300px] block">
                <div className="relative left-1/2 isolate mb-2 h-8 w-8 -translate-x-1/2"></div>
                <div className="rounded-lg bg-gray-800/50 px-3 py-1">
                  <span>Ruins of Caldrath</span>
                  <Badge className="mx-auto ml-2 block w-fit bg-gray-700/60">
                    Level 80
                  </Badge>
                </div>
              </a>

              <a href="#" className="absolute left-[890px] top-[280px] block">
                <div className="relative left-1/2 isolate mb-2 h-8 w-8 -translate-x-1/2"></div>
                <div className="rounded-lg bg-gray-800/50 px-3 py-1">
                  <span>Goblins Camp</span>
                  <Badge className="mx-auto ml-2 block w-fit bg-gray-700/60">
                    Level 40
                  </Badge>
                </div>
              </a>

              <a href="#" className="absolute left-[190px] top-[130px] block">
                <div className="relative left-1/2 isolate mb-2 h-8 w-8 -translate-x-1/2"></div>
                <div className="rounded-lg bg-gray-800/50 px-3 py-1">
                  <span>Frostcrown Peaks</span>
                  <Badge className="mx-auto ml-2 block w-fit bg-gray-700/60">
                    Level 50
                  </Badge>
                </div>
              </a>

              <a href="#" className="absolute left-[595px] top-[130px] block">
                <div className="relative left-1/2 isolate mb-2 h-8 w-8 -translate-x-1/2"></div>
                <div className="rounded-lg bg-gray-800/50 px-3 py-1">
                  <span>Mount Doom</span>
                  <Badge className="mx-auto ml-2 block w-fit bg-gray-700/60">
                    Level 150
                  </Badge>
                </div>
              </a>

              <a href="#" className="absolute left-[50px] top-[890px] block">
                <div className="relative left-1/2 isolate mb-2 h-8 w-8 -translate-x-1/2"></div>
                <div className="rounded-lg bg-gray-800/50 px-3 py-1">
                  <span>Pirate Island</span>
                  <Badge className="mx-auto ml-2 block w-fit bg-gray-700/60">
                    Level 200
                  </Badge>
                </div>
              </a>
            </div>
          </div>
        </DragScrollContainer>
      </div>
    </main>
  );
};

export default MapPage;
