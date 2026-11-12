import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "~/components/admin/fields";
import { MapEditor } from "~/components/admin/MapEditor";
import { NpcSummary } from "~/components/admin/settlements/NpcSummary";
import { NewProjectForm, ProjectRows } from "~/components/admin/projects/ProjectList";
import {
  NewNpcButton,
  SettlementForm,
} from "~/components/admin/settlements/SettlementForm";
import { StorageEditor } from "~/components/admin/settlements/StorageEditor";
import { WorldCrumbs } from "~/components/admin/world/WorldNav";
import { NpcHead } from "~/components/game/map/NpcHead";
import { StorageFace } from "~/components/game/map/StorageFace";
import { settlementHref } from "~/game/settlements";
import { headCrop, mapPoint } from "~/game/world/maps";
import { prisma } from "~/lib/prisma";
import { getStorageIcon } from "~/server/settlements";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { listProjects } from "~/server/admin/projects";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSettlementPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdminPageAccess();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [settlement, locations, projects, storageIcon] = await Promise.all([
    prisma.settlement.findUnique({
      where: { id },
      include: {
        location: { select: { name: true } },
        storage: {
          select: {
            id: true,
            name: true,
            description: true,
            unlockCost: true,
            slots: true,
            enabled: true,
            mapX: true,
            mapY: true,
            _count: { select: { players: true } },
          },
        },
        npcs: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            portrait: true,
            headX: true,
            headY: true,
            headSize: true,
            mapX: true,
            mapY: true,
            profession: { select: { name: true } },
            enabled: true,
            requiredStage: { select: { name: true } },
            _count: { select: { offers: true, quests: true } },
          },
        },
      },
    }),
    prisma.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listProjects({ settlementId: id }),
    getStorageIcon(),
  ]);
  if (!settlement) notFound();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <WorldCrumbs
            trail={[
              {
                label: settlement.location.name,
                href: `/admin/world/${settlement.locationId}?tab=settlements`,
              },
              { label: settlement.name },
            ]}
          />
          <h1 className="mt-2 text-3xl font-bold">{settlement.name}</h1>
        </div>
        <Link
          href={settlementHref(settlement.id)}
          className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
        >
          Open player page
        </Link>
      </header>

      <SettlementForm
        settlement={{
          id: settlement.id,
          locationId: settlement.locationId,
          name: settlement.name,
          kind: settlement.kind,
          description: settlement.description,
          image: settlement.image,
          enabled: settlement.enabled,
          sortOrder: settlement.sortOrder,
        }}
        locations={locations}
        npcCount={settlement.npcs.length}
        projectCount={projects.length}
      />

      <MapEditor
        map="settlement"
        id={settlement.id}
        title="Settlement map"
        description="Players see this map on the settlement page. Drag each NPC, and the storage, to where they stand; anything off the map is still listed beside it. Choose an NPC's head on its page."
        imageHint="1536×1024, e.g. /assets/world/tenreed-settlement-map-v1.png"
        image={settlement.mapImage}
        pins={[
          ...settlement.npcs.map((npc) => ({
            kind: "npc" as const,
            id: npc.id,
            name: npc.name,
            detail: npc.enabled ? (npc.profession?.name ?? "NPC") : "Disabled",
            variant: "person" as const,
            face: <NpcHead portrait={npc.portrait} crop={headCrop(npc)} />,
            point: mapPoint(npc),
          })),
          ...(settlement.storage
            ? [
                {
                  kind: "storage" as const,
                  id: settlement.storage.id,
                  name: settlement.storage.name,
                  detail: settlement.storage.enabled
                    ? `${settlement.storage.slots} slots`
                    : "Disabled",
                  variant: "place" as const,
                  face: <StorageFace icon={storageIcon} />,
                  point: mapPoint(settlement.storage),
                },
              ]
            : []),
        ]}
      />

      <StorageEditor
        settlementId={settlement.id}
        renters={settlement.storage?._count.players ?? 0}
        storage={
          settlement.storage
            ? {
                id: settlement.storage.id,
                name: settlement.storage.name,
                description: settlement.storage.description,
                unlockCost: Number(settlement.storage.unlockCost),
                slots: settlement.storage.slots,
                enabled: settlement.storage.enabled,
              }
            : null
        }
      />

      <Panel
        title="NPCs"
        description="Open an NPC to edit its profile, what it sells and the quests it gives. Move NPCs between settlements under World › All NPCs."
        action={<NewNpcButton settlementId={settlement.id} />}
      >
        {settlement.npcs.length === 0 ? (
          <p className="text-sm text-white/45">No NPCs here yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {settlement.npcs.map((npc) => (
              <li key={npc.id}>
                <Link
                  href={`/admin/npcs/${npc.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-gray-900/60"
                >
                  <NpcSummary npc={npc} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Community projects"
        description="Goals every player works on together by handing in items, in one or more stages. Open a project to set what it needs, when it runs, who can help, what helpers earn and what it changes."
      >
        <ProjectRows projects={projects} />
        <NewProjectForm settlementId={settlement.id} />
      </Panel>
    </div>
  );
}
