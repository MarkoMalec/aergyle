import Link from "next/link";
import { CreatureKind } from "~/generated/prisma/enums";
import { DungeonAdminClient } from "~/components/admin/dungeons/DungeonAdminClient";
import { prisma } from "~/lib/prisma";
import { getStatGrowthRules } from "~/server/stats";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDungeonsPage() {
  await requireAdminPageAccess();
  const [config, dungeons, monsters, locations, items, activeRuns, statGrowth] =
    await Promise.all([
      prisma.dungeonConfig.findUnique({ where: { id: 1 } }),
      prisma.dungeon.findMany({
        orderBy: [
          { location: { name: "asc" } },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
        include: {
          location: { select: { name: true } },
          monsters: {
            select: {
              creatureId: true,
              enabled: true,
              minCount: true,
              maxCount: true,
            },
          },
          _count: { select: { runs: { where: { claimedAt: null } } } },
        },
      }),
      prisma.creature.findMany({
        where: { kind: CreatureKind.MONSTER },
        orderBy: { name: "asc" },
        include: {
          drops: {
            orderBy: [{ requiredLevel: "asc" }, { id: "asc" }],
            include: {
              item: {
                select: { id: true, name: true, sprite: true, rarity: true },
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
      prisma.userDungeonRun.count({ where: { claimedAt: null } }),
      getStatGrowthRules(),
    ]);

  const stats = [
    { label: "Dungeons", value: dungeons.length },
    { label: "Monsters", value: monsters.length },
    {
      label: "Drop entries",
      value: monsters.reduce((sum, monster) => sum + monster.drops.length, 0),
    },
    { label: "Characters inside", value: activeRuns },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dungeons Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Place dungeons in world locations, choose their monsters and how
            many fight at once, and balance monster stats and drop tables.
          </p>
          <p className="mt-2 text-xs text-white/50">
            Runs snapshot the character and monsters on entry, so edits apply to
            the next run. Dungeons grant XP only; every item comes from the
            monsters defeated inside.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dungeons"
            className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
          >
            Open player page
          </Link>
          <Link
            href="/monsters"
            className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
          >
            Open bestiary
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            className="rounded-lg border border-white/10 bg-gray-900/35 p-3"
            key={stat.label}
          >
            <div className="text-2xl font-semibold">{stat.value}</div>
            <div className="text-xs text-white/50">{stat.label}</div>
          </div>
        ))}
      </div>

      <DungeonAdminClient
        config={{
          minimumHealthToStartPercent:
            config?.minimumHealthToStartPercent ?? 25,
          deathLootKeepChance: config?.deathLootKeepChance ?? 0.35,
          deathLootQuantityPercent: config?.deathLootQuantityPercent ?? 25,
        }}
        dungeons={dungeons.map((dungeon) => ({
          id: dungeon.id,
          locationId: dungeon.locationId,
          locationName: dungeon.location.name,
          name: dungeon.name,
          description: dungeon.description,
          difficulty: dungeon.difficulty,
          requiredLevel: dungeon.requiredLevel,
          durationSeconds: dungeon.durationSeconds,
          packSize: dungeon.packSize,
          xpReward: dungeon.xpReward,
          enabled: dungeon.enabled,
          sortOrder: dungeon.sortOrder,
          activeRuns: dungeon._count.runs,
          monsters: dungeon.monsters,
          updatedAt: dungeon.updatedAt.toISOString(),
        }))}
        monsters={monsters}
        locations={locations}
        items={items}
        statGrowth={statGrowth}
      />
    </div>
  );
}
