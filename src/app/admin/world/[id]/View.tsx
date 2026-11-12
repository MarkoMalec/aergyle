import Link from "next/link";
import { notFound } from "next/navigation";
import { DungeonAdminSection } from "~/components/admin/dungeons/DungeonAdminSection";
import { Panel } from "~/components/admin/fields";
import { GatheringAdminSection } from "~/components/admin/gathering/GatheringAdminSection";
import { HuntingAdminSection } from "~/components/admin/hunting/HuntingAdminSection";
import { LocationForm } from "~/components/admin/locations/LocationForm";
import { LocationResourcesEditor } from "~/components/admin/locations/LocationResourcesEditor";
import { MapEditor } from "~/components/admin/MapEditor";
import { NewSettlementForm } from "~/components/admin/settlements/NewSettlementForm";
import { activeTab, TabLinks, WorldCrumbs } from "~/components/admin/world/WorldNav";
import { PLACE_ICONS } from "~/components/game/map/placeIcons";
import { VocationalActionType } from "~/generated/prisma/enums";
import { SETTLEMENT_KIND_LABELS } from "~/game/settlements";
import { mapPoint } from "~/game/world/maps";
import { prisma } from "~/lib/prisma";

const TABS = [
  "overview",
  "settlements",
  "dungeons",
  "hunting",
  "gathering",
  "resources",
] as const;

const placeSelect = {
  id: true,
  name: true,
  enabled: true,
  mapX: true,
  mapY: true,
} as const;

export async function RegionWorkspace(props: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const id = Number(props.params.id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const tab = activeTab(TABS, props.searchParams.tab);

  const region = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      requiredLevel: true,
      gatheringEnabled: true,
      _count: {
        select: {
          settlements: true,
          dungeons: true,
          huntingGrounds: true,
          resources: {
            where: {
              enabled: true,
              resource: { actionType: { not: VocationalActionType.GATHERING } },
            },
          },
        },
      },
    },
  });
  if (!region) notFound();
  const base = `/admin/world/${region.id}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <WorldCrumbs trail={[{ label: region.name }]} />
        <h1 className="text-3xl font-bold">{region.name}</h1>
        <p className="text-sm text-white/60">
          Region · character level {region.requiredLevel} to travel here
        </p>
      </header>

      <TabLinks
        base={base}
        active={tab}
        tabs={[
          { key: "overview", label: "Overview & map" },
          { key: "settlements", label: "Settlements", count: region._count.settlements },
          { key: "dungeons", label: "Dungeons", count: region._count.dungeons },
          { key: "hunting", label: "Hunting grounds", count: region._count.huntingGrounds },
          { key: "gathering", label: region.gatheringEnabled ? "Gathering" : "Gathering (off)" },
          { key: "resources", label: "Vocation resources", count: region._count.resources },
        ]}
      />

      {tab === "overview" ? (
        <OverviewTab
          id={region.id}
          deleteWarning={`Delete ${region.name}? Its ${region._count.settlements} settlements (with their projects and storage), ${region._count.dungeons} dungeons and ${region._count.huntingGrounds} hunting grounds are deleted too; their NPCs move to No location. This cannot be undone.`}
        />
      ) : null}
      {tab === "settlements" ? <SettlementsTab id={region.id} name={region.name} /> : null}
      {tab === "dungeons" ? (
        <>
          <GlobalNote href="/admin/dungeons">
            Monsters, drop tables and the rules for every dungeon
          </GlobalNote>
          <DungeonAdminSection locationId={region.id} />
        </>
      ) : null}
      {tab === "hunting" ? (
        <>
          <GlobalNote href="/admin/hunting">
            Animals, drop tables, durations, safety rules and the simulator
          </GlobalNote>
          <HuntingAdminSection locationId={region.id} />
        </>
      ) : null}
      {tab === "gathering" ? (
        <>
          <GlobalNote href="/admin/gathering">
            The resource catalogue, durations and the simulator
          </GlobalNote>
          <GatheringAdminSection locationId={region.id} />
        </>
      ) : null}
      {tab === "resources" ? <ResourcesTab id={region.id} /> : null}
    </div>
  );
}

/** Points at the game-wide page for what a region tab does not hold. */
function GlobalNote(props: { href: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-white/55">
      {props.children} are shared by all regions:{" "}
      <Link href={props.href} className="text-amber-200 underline hover:text-amber-100">
        edit them here
      </Link>
      .
    </p>
  );
}

async function OverviewTab(props: { id: number; deleteWarning: string }) {
  const region = await prisma.location.findUniqueOrThrow({
    where: { id: props.id },
    select: {
      id: true,
      name: true,
      requiredLevel: true,
      mapImage: true,
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
  });
  const disabled = (place: { enabled: boolean }) =>
    place.enabled ? "" : " · disabled";

  return (
    <div className="space-y-6">
      <Panel
        title="Details"
        description="Players below this character level cannot travel here."
      >
        <LocationForm
          locationId={region.id}
          initialValues={{ name: region.name, requiredLevel: region.requiredLevel }}
          deleteWarning={props.deleteWarning}
        />
      </Panel>

      <MapEditor
        map="location"
        id={region.id}
        title="Region map"
        description="Players see this map on the Region page while they are here. Drag the pins where the places are; a place off the map is still listed beside it. Disabled places stay hidden from players."
        imageHint="1536×1024, e.g. /assets/world/greenveil-plains-region-map-v1.png"
        image={region.mapImage}
        pins={[
          ...region.settlements.map((settlement) => ({
            kind: "settlement" as const,
            id: settlement.id,
            name: settlement.name,
            detail: `${SETTLEMENT_KIND_LABELS[settlement.kind]}${disabled(settlement)}`,
            variant: "settlement" as const,
            face: <PLACE_ICONS.settlement />,
            point: mapPoint(settlement),
          })),
          ...region.dungeons.map((dungeon) => ({
            kind: "dungeon" as const,
            id: dungeon.id,
            name: dungeon.name,
            detail: `Dungeon${disabled(dungeon)}`,
            variant: "place" as const,
            face: <PLACE_ICONS.dungeon />,
            point: mapPoint(dungeon),
          })),
          ...region.huntingGrounds.map((ground) => ({
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
    </div>
  );
}

async function SettlementsTab(props: { id: number; name: string }) {
  const settlements = await prisma.settlement.findMany({
    where: { locationId: props.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      enabled: true,
      mapImage: true,
      storage: { select: { enabled: true } },
      _count: { select: { npcs: true, projects: true } },
    },
  });

  return (
    <div className="space-y-6">
      <Panel
        title="Settlements"
        description="Open a settlement to edit its NPCs (shops and quests), storage, community projects and map."
      >
        {settlements.length === 0 ? (
          <p className="text-sm text-white/45">No settlements here yet.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {settlements.map((settlement) => (
              <li key={settlement.id}>
                <Link
                  href={`/admin/settlements/${settlement.id}`}
                  className="flex h-full items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3 hover:bg-white/[0.07]"
                >
                  <span className="min-w-0">
                    <strong className="block truncate">{settlement.name}</strong>
                    <small className="text-white/45">
                      {[
                        SETTLEMENT_KIND_LABELS[settlement.kind],
                        `${settlement._count.npcs} NPCs`,
                        `${settlement._count.projects} projects`,
                        settlement.storage?.enabled ? "storage" : null,
                        settlement.mapImage ? null : "no map",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span
                    className={
                      settlement.enabled
                        ? "text-xs text-emerald-300"
                        : "text-xs text-white/35"
                    }
                  >
                    {settlement.enabled ? "Enabled" : "Disabled"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <NewSettlementForm locations={[{ id: props.id, name: props.name }]} />
    </div>
  );
}

async function ResourcesTab(props: { id: number }) {
  const [resources, assigned] = await Promise.all([
    prisma.vocationalResource.findMany({
      where: { actionType: { not: VocationalActionType.GATHERING } },
      select: {
        id: true,
        actionType: true,
        name: true,
        item: { select: { name: true } },
      },
      orderBy: [{ actionType: "asc" }, { name: "asc" }],
    }),
    prisma.locationVocationalResource.findMany({
      where: {
        locationId: props.id,
        resource: { actionType: { not: VocationalActionType.GATHERING } },
      },
      select: { resourceId: true, enabled: true },
    }),
  ]);

  return (
    <LocationResourcesEditor
      locationId={props.id}
      resources={resources}
      assigned={assigned}
    />
  );
}
