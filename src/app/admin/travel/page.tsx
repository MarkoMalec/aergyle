import { TravelRoutesEditor } from "~/components/admin/travel/TravelRoutesEditor";
import { prisma } from "~/lib/prisma";
import { getDefaultTravelSeconds } from "~/server/travel/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminTravelPage() {
  const [locations, routes, defaultSeconds] = await Promise.all([
    prisma.location.findMany({
      select: { id: true, name: true },
      orderBy: [{ requiredLevel: "asc" }, { id: "asc" }],
    }),
    prisma.travelRoute.findMany({
      select: { locationAId: true, locationBId: true, seconds: true },
    }),
    getDefaultTravelSeconds(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Travel Admin</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/70">
          Set how long journeys between locations take.
        </p>
        <p className="mt-2 text-xs text-white/50">
          The arrival time is fixed when a journey starts, from the route time
          and the character&apos;s movement speed at that moment. Saving does
          not change journeys already underway.
        </p>
      </header>

      <TravelRoutesEditor
        locations={locations}
        routes={routes}
        defaultSeconds={defaultSeconds}
      />
    </div>
  );
}
