import { CreatureKind } from "~/generated/prisma/enums";
import { DungeonAdminClient } from "~/components/admin/dungeons/DungeonAdminClient";
import { StatTiles } from "~/components/admin/fields";
import { prisma } from "~/lib/prisma";
import { getStageOptions } from "~/server/admin/projects";
import { getStatGrowthRules } from "~/server/stats";
import { getCombatConfig } from "~/server/combat/config";

/** Dungeon editor for every dungeon, or only one region's when locationId is set. */
export async function DungeonAdminSection({
  locationId,
}: {
  locationId?: number;
}) {
  const [
    config,
    dungeons,
    monsters,
    locations,
    items,
    activeRuns,
    statGrowth,
    combatConfig,
    stages,
  ] = await Promise.all([
    prisma.dungeonConfig.findUnique({ where: { id: 1 } }),
    prisma.dungeon.findMany({
      where: { locationId },
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
      select: { id: true, name: true, requiredLevel: true },
    }),
    // Only the bestiary editor needs items, and a region page hides it.
    locationId
      ? []
      : prisma.item.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, sprite: true, rarity: true },
        }),
    prisma.userDungeonRun.count({ where: { claimedAt: null } }),
    getStatGrowthRules(),
    getCombatConfig(),
    getStageOptions(),
  ]);

  return (
    <>
      {locationId ? null : (
        <StatTiles
          stats={[
            { label: "Dungeons", value: dungeons.length },
            { label: "Monsters", value: monsters.length },
            {
              label: "Drop entries",
              value: monsters.reduce((sum, monster) => sum + monster.drops.length, 0),
            },
            { label: "Characters inside", value: activeRuns },
          ]}
        />
      )}
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
          requiredStageId: dungeon.requiredStageId,
          activeRuns: dungeon._count.runs,
          monsters: dungeon.monsters,
          updatedAt: dungeon.updatedAt.toISOString(),
        }))}
        monsters={monsters}
        locations={locations}
        stages={stages}
        items={items}
        statGrowth={statGrowth}
        combatConfig={combatConfig}
        locationId={locationId}
      />
    </>
  );
}
