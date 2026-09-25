import Link from "next/link";
import React from "react";
import { MapEditor } from "~/components/admin/MapEditor";
import { PLACE_ICONS } from "~/components/game/map/placeIcons";
import { mapPoint } from "~/game/world/maps";
import { prisma } from "~/lib/prisma";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLocationsPage() {
  await requireAdminPageAccess();
  const [locations, atlas] = await Promise.all([
    prisma.location.findMany({
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        mapX: true,
        mapY: true,
        _count: { select: { resources: true } },
      },
      orderBy: [{ id: "desc" }],
      take: 500,
    }),
    prisma.atlasConfig.findUnique({
      where: { id: 1 },
      select: { mapImage: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-sm text-white/70">
            Create locations and configure which resources are available.
          </p>
        </div>
        <Link
          href="/admin/locations/new"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          New Location
        </Link>
      </div>

      <MapEditor
        map="world"
        id={1}
        title="World atlas"
        description="The map players open from the Map menu. Drag a location where it belongs; a location that is not on the atlas cannot be travelled to from it. Changing the artwork keeps every pin where it is."
        imageHint="1536×1024, e.g. /assets/world/world-map-v1.png"
        image={atlas?.mapImage ?? null}
        pins={locations.map((location) => ({
          kind: "location" as const,
          id: location.id,
          name: location.name,
          detail: `Level ${location.requiredLevel}`,
          variant: "place" as const,
          face: <PLACE_ICONS.location />,
          point: mapPoint(location),
        }))}
      />

      <div className="overflow-hidden rounded-lg border border-gray-800/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/50 text-white/80">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-right">Required level</th>
              <th className="p-3 text-right">Resources</th>
              <th className="p-3 text-right">ID</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id} className="border-t border-gray-800/60">
                <td className="p-3">
                  <Link
                    href={`/admin/locations/${l.id}`}
                    className="font-semibold text-white hover:underline"
                  >
                    {l.name}
                  </Link>
                </td>
                <td className="p-3 text-right text-white/80">
                  {l.requiredLevel}
                </td>
                <td className="p-3 text-right text-white/80">
                  {l._count.resources}
                </td>
                <td className="p-3 text-right font-mono text-white/60">
                  {l.id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-white/60">
        Showing {locations.length} locations.
      </div>
    </div>
  );
}
