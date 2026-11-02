import { NpcBoard } from "~/components/admin/settlements/NpcBoard";
import { ProfessionsDialog } from "~/components/admin/settlements/ProfessionsDialog";
import { NewNpcButton } from "~/components/admin/settlements/SettlementForm";
import { prisma } from "~/lib/prisma";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminNpcsPage() {
  await requireAdminPageAccess();
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
        requiredProject: { select: { name: true } },
        _count: { select: { offers: true, quests: true } },
      },
    }),
    prisma.npcProfession.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { npcs: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">NPCs</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Every NPC, by location and settlement. Drag an NPC onto another
            settlement to move it there, or onto No location to take it out of
            the world. Open an NPC to edit its profile, shop and quests.
          </p>
        </div>
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
      </header>

      <NpcBoard locations={locations} npcs={npcs} />
    </div>
  );
}
