import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Panel } from "~/components/admin/fields";
import { LocationForm } from "~/components/admin/locations/LocationForm";
import { MapEditor } from "~/components/admin/MapEditor";
import { NpcBoard } from "~/components/admin/settlements/NpcBoard";
import { ProfessionsDialog } from "~/components/admin/settlements/ProfessionsDialog";
import { NewNpcButton } from "~/components/admin/settlements/SettlementForm";
import { StorageIconForm } from "~/components/admin/settlements/StorageEditor";
import { TravelRoutesEditor } from "~/components/admin/travel/TravelRoutesEditor";
import { ProjectRows } from "~/components/admin/projects/ProjectList";
import { activeTab, TabLinks } from "~/components/admin/world/WorldNav";
import { PLACE_ICONS } from "~/components/game/map/placeIcons";
import { mapPoint } from "~/game/world/maps";
import { prisma } from "~/lib/prisma";
import { listProjects } from "~/server/admin/projects";
import { getStorageIcon } from "~/server/settlements";
import { getDefaultTravelSeconds } from "~/server/travel/service";

const TABS = ["regions", "npcs", "projects", "travel"] as const;

export async function WorldHub(props: {
  searchParams: { tab?: string };
}) {
  const tab = activeTab(TABS, props.searchParams.tab);
  const [regionCount, npcCount, projectCount] = await Promise.all([
    prisma.location.count(),
    prisma.npc.count(),
    prisma.communityProject.count(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">World</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/70">
          Everything players can visit. A region holds its settlements (with
          NPCs, shops, quests, storage and community projects), dungeons,
          hunting grounds and resources. Open a region to edit what is in it.
        </p>
      </header>

      <TabLinks
        base="/admin/world"
        active={tab}
        tabs={[
          { key: "regions", label: "Regions & atlas", count: regionCount },
          { key: "npcs", label: "All NPCs", count: npcCount },
          { key: "projects", label: "Community projects", count: projectCount },
          { key: "travel", label: "Travel times" },
        ]}
      />

      {tab === "regions" ? <RegionsTab /> : null}
      {tab === "npcs" ? <NpcsTab /> : null}
      {tab === "projects" ? <ProjectsTab /> : null}
      {tab === "travel" ? <TravelTab /> : null}
    </div>
  );
}

async function RegionsTab() {
  const [regions, atlas, storageIcon] = await Promise.all([
    prisma.location.findMany({
      orderBy: [{ requiredLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        mapImage: true,
        mapX: true,
        mapY: true,
        gatheringEnabled: true,
        _count: {
          select: {
            settlements: true,
            dungeons: true,
            huntingGrounds: true,
            resources: { where: { enabled: true } },
          },
        },
      },
    }),
    prisma.atlasConfig.findUnique({
      where: { id: 1 },
      select: { mapImage: true },
    }),
    getStorageIcon(),
  ]);

  return (
    <div className="space-y-6">
      <Panel
        title="Regions"
        description="Sorted by the character level needed to travel there. Warnings point at things players will miss."
      >
        {regions.length === 0 ? (
          <p className="text-sm text-white/45">No regions yet. Create the first one below.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {regions.map((region) => {
              const warnings = [
                region.mapX === null ? "Not on the atlas" : null,
                region.mapImage ? null : "No region map",
              ].filter(Boolean);
              const counts = [
                [region._count.settlements, "settlements"],
                [region._count.dungeons, "dungeons"],
                [region._count.huntingGrounds, "hunting grounds"],
                [region._count.resources, "resources"],
              ] as const;
              return (
                <li key={region.id}>
                  <Link
                    href={`/admin/world/${region.id}`}
                    className="block h-full rounded-lg bg-white/[0.03] p-3 hover:bg-white/[0.07]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="truncate">{region.name}</strong>
                      <span className="shrink-0 text-xs text-white/50">
                        Level {region.requiredLevel}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      {counts.map(([n, label]) => `${n} ${label}`).join(" · ")}
                      {region.gatheringEnabled ? " · gathering" : ""}
                    </div>
                    {warnings.length ? (
                      <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-300/90">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {warnings.join(" · ")}
                      </div>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="New region"
        description="Creates an empty region and opens it, so you can place it on the atlas and fill it."
      >
        <LocationForm />
      </Panel>

      <MapEditor
        map="world"
        id={1}
        title="World atlas"
        description="The map players open from the Map menu. Drag a region where it belongs; a region that is not on the atlas cannot be travelled to from it. Changing the artwork keeps every pin where it is."
        imageHint="1536×1024, e.g. /assets/world/world-map-v1.png"
        image={atlas?.mapImage ?? null}
        pins={regions.map((region) => ({
          kind: "location" as const,
          id: region.id,
          name: region.name,
          detail: `Level ${region.requiredLevel}`,
          variant: "place" as const,
          face: <PLACE_ICONS.location />,
          point: mapPoint(region),
        }))}
      />

      <StorageIconForm icon={storageIcon} />
    </div>
  );
}

async function NpcsTab() {
  const [locations, npcs, professions] = await Promise.all([
    prisma.location.findMany({
      orderBy: [{ requiredLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        settlements: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, kind: true, enabled: true },
        },
      },
    }),
    prisma.npc.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        settlementId: true,
        name: true,
        portrait: true,
        profession: { select: { name: true } },
        enabled: true,
        requiredStage: { select: { name: true } },
        _count: { select: { offers: true, quests: true } },
      },
    }),
    prisma.npcProfession.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { npcs: true } } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-3xl text-sm text-white/60">
          Every NPC, by region and settlement. Drag an NPC onto another
          settlement to move it, or onto No location to take it out of the
          world. Open an NPC to edit its profile, shop and quests.
        </p>
        <div className="flex flex-wrap gap-2">
          <ProfessionsDialog
            professions={professions.map((profession) => ({
              id: profession.id,
              name: profession.name,
              npcs: profession._count.npcs,
            }))}
          />
          <NewNpcButton settlementId={null} />
        </div>
      </div>
      <NpcBoard locations={locations} npcs={npcs} />
    </div>
  );
}

async function ProjectsTab() {
  const projects = await listProjects({});
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-white/60">
        Every community project in the world and where it stands. Open one to
        edit it; create new ones on a settlement&apos;s page.
      </p>
      <ProjectRows projects={projects} showSettlement />
    </div>
  );
}

async function TravelTab() {
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
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-white/60">
        How long journeys between regions take. The arrival time is fixed when
        a journey starts, so saving does not change journeys already underway.
      </p>
      {/* w-0 min-w-full: the matrix scrolls inside instead of widening /admin. */}
      <div className="w-0 min-w-full">
        <TravelRoutesEditor
          locations={locations}
          routes={routes}
          defaultSeconds={defaultSeconds}
        />
      </div>
    </div>
  );
}
