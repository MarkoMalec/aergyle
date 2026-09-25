import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { Panel } from "~/components/admin/fields";
import { MapEditor } from "~/components/admin/MapEditor";
import { ProjectsEditor } from "~/components/admin/settlements/ProjectsEditor";
import {
  NewNpcButton,
  SettlementForm,
} from "~/components/admin/settlements/SettlementForm";
import { StorageEditor } from "~/components/admin/settlements/StorageEditor";
import { NpcHead } from "~/components/game/map/NpcHead";
import { StorageFace } from "~/components/game/map/StorageFace";
import { NPC_PROFESSION_LABELS, settlementHref } from "~/game/settlements";
import { headCrop, mapPoint } from "~/game/world/maps";
import { prisma } from "~/lib/prisma";
import { getStorageIcon } from "~/server/settlements";
import { requireAdminPageAccess } from "~/server/admin/auth";

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

  const [settlement, locations, items, storageIcon] = await Promise.all([
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
            profession: true,
            enabled: true,
            requiredProject: { select: { name: true } },
            _count: { select: { offers: true, quests: true } },
          },
        },
        projects: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            description: true,
            image: true,
            enabled: true,
            sortOrder: true,
            completedAt: true,
            updatedAt: true,
            requirements: {
              orderBy: { id: "asc" },
              select: {
                itemId: true,
                quantity: true,
                contributed: true,
                contributions: { select: { userId: true } },
              },
            },
            unlocksNpcs: { select: { name: true } },
            unlocksOffers: {
              select: {
                item: { select: { name: true } },
                npc: { select: { name: true } },
              },
            },
            unlocksQuests: {
              select: { name: true, npc: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.item.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sprite: true, rarity: true },
    }),
    getStorageIcon(),
  ]);
  if (!settlement) notFound();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/settlements"
            className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" /> All settlements
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{settlement.name}</h1>
          <p className="mt-1 text-sm text-white/60">
            In {settlement.location.name}
          </p>
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
        projectCount={settlement.projects.length}
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
            detail: npc.enabled
              ? npc.profession
                ? NPC_PROFESSION_LABELS[npc.profession]
                : "NPC"
              : "Disabled",
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
        description="Open an NPC to edit its profile, what it sells and the quests it gives. You can move an NPC to another settlement from its page."
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
                  {npc.portrait?.startsWith("/") ? (
                    <Image
                      src={npc.portrait}
                      alt=""
                      width={56}
                      height={84}
                      className="h-[84px] w-14 shrink-0 rounded-lg bg-black/30 object-cover object-top"
                    />
                  ) : (
                    <span className="grid h-[84px] w-14 shrink-0 place-items-center rounded-lg bg-black/30">
                      <UserRound className="h-6 w-6 text-white/30" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{npc.name}</strong>
                    <small className="block text-white/45">
                      {npc.profession
                        ? `${NPC_PROFESSION_LABELS[npc.profession]} · `
                        : ""}
                      {npc._count.offers} for sale · {npc._count.quests} quests
                    </small>
                    {npc.requiredProject ? (
                      <small className="block text-amber-300/80">
                        Hidden until “{npc.requiredProject.name}” is complete
                      </small>
                    ) : null}
                  </span>
                  <span
                    className={
                      npc.enabled
                        ? "text-xs text-emerald-300"
                        : "text-xs text-white/35"
                    }
                  >
                    {npc.enabled ? "Enabled" : "Disabled"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ProjectsEditor
        settlementId={settlement.id}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.sprite,
          detail: item.rarity.toLowerCase(),
        }))}
        projects={settlement.projects.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          image: project.image,
          enabled: project.enabled,
          sortOrder: project.sortOrder,
          completedAt: project.completedAt?.toISOString() ?? null,
          updatedAt: project.updatedAt.toISOString(),
          requirements: project.requirements.map((requirement) => ({
            itemId: requirement.itemId,
            quantity: requirement.quantity,
            contributed: requirement.contributed,
          })),
          contributors: new Set(
            project.requirements.flatMap((requirement) =>
              requirement.contributions.map((row) => row.userId),
            ),
          ).size,
          unlocks: [
            ...project.unlocksNpcs.map((npc) => `NPC ${npc.name}`),
            ...project.unlocksOffers.map(
              (offer) => `${offer.item.name} at ${offer.npc.name}`,
            ),
            ...project.unlocksQuests.map(
              (quest) => `Quest “${quest.name}” (${quest.npc.name})`,
            ),
          ],
        }))}
      />
    </div>
  );
}
