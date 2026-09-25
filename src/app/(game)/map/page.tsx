import React from "react";
import PageHeading from "~/components/game/ui/PageHeading";
import { redirect } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { getJourneySeconds, getTravelStatus } from "~/server/travel/service";
import WorldAtlas from "~/components/game/map/WorldAtlas";
import { mapPoint } from "~/game/world/maps";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MapPage = async () => {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect("/play");
  }

  const [locations, user, atlas] = await Promise.all([
    prisma.location.findMany({
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        mapX: true,
        mapY: true,
      },
      orderBy: [{ requiredLevel: "asc" }, { id: "asc" }],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentLocationId: true, level: true },
    }),
    prisma.atlasConfig.findUnique({
      where: { id: 1 },
      select: { mapImage: true },
    }),
  ]);

  const [travelStatus, journeySeconds] = await Promise.all([
    getTravelStatus(session.user.id),
    getJourneySeconds(
      session.user.id,
      user?.currentLocationId ?? null,
      locations.map((location) => location.id),
    ),
  ]);
  return (
    <main>
      <PageHeading
        eyebrow="Beyond the familiar"
        title="World atlas"
        description="Explore the realm through its landmarks. Open a field entry to learn about a place or begin your journey."
      />

      <WorldAtlas
        image={atlas?.mapImage ?? null}
        locations={locations.map((location) => ({
          id: location.id,
          name: location.name,
          requiredLevel: location.requiredLevel,
          point: mapPoint(location),
        }))}
        currentLocationId={user?.currentLocationId ?? null}
        userLevel={user?.level ?? 1}
        activeTravel={travelStatus.travel}
        journeySeconds={Object.fromEntries(journeySeconds)}
      />
    </main>
  );
};

export default MapPage;
