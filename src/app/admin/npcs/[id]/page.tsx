import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NpcEditor } from "~/components/admin/settlements/NpcEditor";
import { QuestsEditor } from "~/components/admin/settlements/QuestsEditor";
import { npcHref } from "~/game/settlements";
import { prisma } from "~/lib/prisma";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminNpcPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdminPageAccess();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [npc, settlements, projects, items, creatures, dungeons] =
    await Promise.all([
      prisma.npc.findUnique({
        where: { id },
        include: {
          settlement: {
            select: { id: true, name: true, location: { select: { name: true } } },
          },
          offers: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
          quests: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            include: {
              objectives: { orderBy: { id: "asc" } },
              rewardItems: { orderBy: { id: "asc" } },
              _count: {
                select: {
                  userQuests: { where: { completedAt: { not: null } } },
                },
              },
            },
          },
        },
      }),
      prisma.settlement.findMany({
        orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, location: { select: { name: true } } },
      }),
      prisma.communityProject.findMany({
        orderBy: [{ settlement: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          completedAt: true,
          settlement: { select: { name: true } },
        },
      }),
      prisma.item.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, sprite: true, rarity: true },
      }),
      prisma.creature.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, asset: true, kind: true },
      }),
      prisma.dungeon.findMany({
        orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, location: { select: { name: true } } },
      }),
    ]);
  if (!npc) notFound();

  const projectOptions = projects.map((project) => ({
    id: project.id,
    name: project.name,
    detail: `${project.settlement.name}${project.completedAt ? " · completed" : ""}`,
  }));
  const itemOptions = items.map((item) => ({
    id: item.id,
    name: item.name,
    image: item.sprite,
    detail: item.rarity.toLowerCase(),
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/settlements/${npc.settlement.id}`}
            className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" /> {npc.settlement.name} (
            {npc.settlement.location.name})
          </Link>
          <h1 className="mt-2 text-3xl font-bold">{npc.name}</h1>
        </div>
        <Link
          href={npcHref(npc.settlement.id, npc.id)}
          className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
        >
          Open player page
        </Link>
      </header>

      <NpcEditor
        // Remount after a save so the draft matches the stored NPC.
        key={npc.updatedAt.toISOString()}
        npc={{
          id: npc.id,
          settlementId: npc.settlementId,
          name: npc.name,
          description: npc.description,
          portrait: npc.portrait,
          headX: npc.headX,
          headY: npc.headY,
          headSize: npc.headSize,
          profession: npc.profession,
          requiredProjectId: npc.requiredProjectId,
          enabled: npc.enabled,
          sortOrder: npc.sortOrder,
          offers: npc.offers.map((offer) => ({
            id: offer.id,
            itemId: offer.itemId,
            price: Number(offer.price),
            availableFrom: offer.availableFrom?.toISOString() ?? null,
            availableUntil: offer.availableUntil?.toISOString() ?? null,
            requiredProjectId: offer.requiredProjectId,
            enabled: offer.enabled,
          })),
        }}
        settlements={settlements.map((settlement) => ({
          id: settlement.id,
          name: settlement.name,
          detail: settlement.location.name,
        }))}
        projects={projectOptions}
        items={itemOptions}
      />

      <QuestsEditor
        npcId={npc.id}
        quests={npc.quests.map((quest) => ({
          id: quest.id,
          name: quest.name,
          description: quest.description,
          repeat: quest.repeat,
          requiredLevel: quest.requiredLevel,
          rewardGold: Number(quest.rewardGold),
          rewardXp: quest.rewardXp,
          requiredProjectId: quest.requiredProjectId,
          enabled: quest.enabled,
          sortOrder: quest.sortOrder,
          objectives: quest.objectives.map((objective) => ({
            type: objective.type,
            itemId: objective.itemId,
            creatureId: objective.creatureId,
            dungeonId: objective.dungeonId,
            quantity: objective.quantity,
          })),
          rewardItems: quest.rewardItems.map((reward) => ({
            itemId: reward.itemId,
            quantity: reward.quantity,
          })),
          completions: quest._count.userQuests,
          updatedAt: quest.updatedAt.toISOString(),
        }))}
        items={itemOptions}
        creatures={creatures.map((creature) => ({
          id: creature.id,
          name: creature.name,
          image: creature.asset,
          detail: creature.kind === "ANIMAL" ? "animal" : "monster",
        }))}
        dungeons={dungeons.map((dungeon) => ({
          id: dungeon.id,
          name: dungeon.name,
          detail: dungeon.location.name,
        }))}
        projects={projectOptions}
      />
    </div>
  );
}
