import React from "react";
import PageHeading from "~/components/game/ui/PageHeading";
import { redirect } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { getJourneySeconds, getTravelStatus } from "~/server/travel/service";
import WorldAtlas from "~/components/game/map/WorldAtlas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MapPage = async () => {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const [locations, user] = await Promise.all([
    prisma.location.findMany({
      select: { id: true, name: true, requiredLevel: true },
      orderBy: [{ requiredLevel: "asc" }, { id: "asc" }],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentLocationId: true, level: true },
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
        locations={locations}
        currentLocationId={user?.currentLocationId ?? null}
        userLevel={user?.level ?? 1}
        activeTravel={travelStatus.travel}
        journeySeconds={Object.fromEntries(journeySeconds)}
      />
    </main>
  );
};

export default MapPage;
