import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { LocationForm } from "~/components/admin/locations/LocationForm";
import { LocationResourcesEditor } from "~/components/admin/locations/LocationResourcesEditor";
import { MapEditor } from "~/components/admin/MapEditor";
import { PLACE_ICONS } from "~/components/game/map/placeIcons";
import { SETTLEMENT_KIND_LABELS } from "~/game/settlements";
import { mapPoint } from "~/game/world/maps";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const placeSelect = {
  id: true,
  name: true,
  enabled: true,
  mapX: true,
  mapY: true,
} as const;

export default async function AdminEditLocationPage(props: {
  params: { id: string };
}) {
  await requireAdminPageAccess();
  const id = Number(props.params.id);
  if (!Number.isFinite(id)) return notFound();

  const [location, resources] = await Promise.all([
    prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        mapImage: true,
        resources: { select: { resourceId: true, enabled: true } },
        settlements: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { ...placeSelect, kind: true },
        },
        dungeons: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: placeSelect,
        },
        huntingGrounds: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: placeSelect,
        },
      },
    }),
    prisma.vocationalResource.findMany({
      select: {
        id: true,
        actionType: true,
        name: true,
        item: { select: { name: true } },
      },
      orderBy: [{ actionType: "asc" }, { name: "asc" }],
      take: 2000,
    }),
  ]);

  if (!location) return notFound();
  const disabled = (place: { enabled: boolean }) =>
    place.enabled ? "" : " · disabled";

  const resourceRows = resources.map((r) => ({
    id: r.id,
    actionType: r.actionType,
    name: r.name,
    item: r.item,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Location</h1>
          <p className="text-sm text-white/70">ID: {location.id}</p>
        </div>
        <Link
          href="/admin/locations"
          className="text-sm text-white/70 hover:text-white"
        >
          Back
        </Link>
      </div>

      <MapEditor
        map="location"
        id={location.id}
        title="Region map"
        description="Players see this map on the Region page while they are here. Drag the pins where the places are; a place off the map is still listed beside it. Disabled places stay hidden from players."
        imageHint="1536×1024, e.g. /assets/world/greenveil-plains-region-map-v1.png"
        image={location.mapImage}
        pins={[
          ...location.settlements.map((settlement) => ({
            kind: "settlement" as const,
            id: settlement.id,
            name: settlement.name,
            detail: `${SETTLEMENT_KIND_LABELS[settlement.kind]}${disabled(settlement)}`,
            variant: "settlement" as const,
            face: <PLACE_ICONS.settlement />,
            point: mapPoint(settlement),
          })),
          ...location.dungeons.map((dungeon) => ({
            kind: "dungeon" as const,
            id: dungeon.id,
            name: dungeon.name,
            detail: `Dungeon${disabled(dungeon)}`,
            variant: "place" as const,
            face: <PLACE_ICONS.dungeon />,
            point: mapPoint(dungeon),
          })),
          ...location.huntingGrounds.map((ground) => ({
            kind: "ground" as const,
            id: ground.id,
            name: ground.name,
            detail: `Hunting ground${disabled(ground)}`,
            variant: "place" as const,
            face: <PLACE_ICONS.ground />,
            point: mapPoint(ground),
          })),
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
          <LocationForm
            mode="edit"
            locationId={location.id}
            initialValues={{
              name: location.name,
              requiredLevel: location.requiredLevel,
            }}
          />
        </div>

        <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
          <LocationResourcesEditor
            locationId={location.id}
            resources={resourceRows}
            assigned={location.resources}
          />
        </div>
      </div>
    </div>
  );
}
