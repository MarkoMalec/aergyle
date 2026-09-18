import Link from "next/link";
import { CreatureKind } from "~/generated/prisma/enums";
import { HuntingAdminClient } from "~/components/admin/hunting/HuntingAdminClient";
import { prisma } from "~/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHuntingPage() {
  const [config, durations, creatures, grounds, locations, items] =
    await Promise.all([
      prisma.huntingConfig.findUnique({ where: { id: 1 } }),
      prisma.huntingDuration.findMany({
        orderBy: [{ sortOrder: "asc" }, { durationSeconds: "asc" }],
      }),
      prisma.creature.findMany({
        where: { kind: CreatureKind.ANIMAL },
        orderBy: { name: "asc" },
        include: {
          drops: {
            orderBy: [{ requiredLevel: "asc" }, { id: "asc" }],
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  sprite: true,
                  rarity: true,
                },
              },
            },
          },
        },
      }),
      prisma.huntingGround.findMany({
        orderBy: [
          { location: { name: "asc" } },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
        include: {
          location: { select: { id: true, name: true } },
          creatures: {
            select: {
              creatureId: true,
              enabled: true,
              encounterWeight: true,
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
        select: {
          id: true,
          name: true,
          sprite: true,
          rarity: true,
        },
      }),
    ]);

  const resolvedConfig = config ?? {
    id: 1,
    damageEnabled: true,
    globalDangerMultiplier: 1,
    maxHealthLossPercent: 30,
    minimumRemainingHealthPercent: 5,
    minimumHealthToStartPercent: 25,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hunting Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Control global safety guardrails, expedition scaling, hunting
            grounds, animal encounters, retaliation, accidents, and material
            drop tables.
          </p>
          <p className="mt-2 text-xs text-white/50">
            Live expeditions use departure snapshots, so balance edits affect
            the next hunt. Global safety reductions also protect hunts already
            underway; they can never make an active hunt harsher.
          </p>
        </div>
        <Link
          href="/skills/Hunting"
          className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
        >
          Open player page
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">{grounds.length}</div>
          <div className="text-xs text-white/50">Hunting grounds</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">{creatures.length}</div>
          <div className="text-xs text-white/50">Animals</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">
            {creatures.reduce(
              (sum, creature) => sum + creature.drops.length,
              0,
            )}
          </div>
          <div className="text-xs text-white/50">Drop entries</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">
            {durations.filter((duration) => duration.enabled).length}
          </div>
          <div className="text-xs text-white/50">Active durations</div>
        </div>
      </div>

      <HuntingAdminClient
        config={{
          damageEnabled: resolvedConfig.damageEnabled,
          globalDangerMultiplier: resolvedConfig.globalDangerMultiplier,
          maxHealthLossPercent: resolvedConfig.maxHealthLossPercent,
          minimumRemainingHealthPercent:
            resolvedConfig.minimumRemainingHealthPercent,
          minimumHealthToStartPercent:
            resolvedConfig.minimumHealthToStartPercent,
        }}
        durations={durations}
        creatures={creatures}
        grounds={grounds.map((ground) => ({
          ...ground,
          locationName: ground.location.name,
        }))}
        locations={locations}
        items={items}
      />
    </div>
  );
}
