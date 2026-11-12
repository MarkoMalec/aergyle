import { CreatureKind } from "~/generated/prisma/enums";
import { StatTiles } from "~/components/admin/fields";
import { HuntingAdminClient } from "~/components/admin/hunting/HuntingAdminClient";
import { prisma } from "~/lib/prisma";
import { getStageOptions } from "~/server/admin/projects";
import { getCombatConfig } from "~/server/combat/config";

/** Hunting editor for the whole game, or only one region's grounds when locationId is set. */
export async function HuntingAdminSection({
  locationId,
}: {
  locationId?: number;
}) {
  const [
    config,
    durations,
    creatures,
    grounds,
    locations,
    items,
    combatConfig,
    stages,
  ] = await Promise.all([
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
      where: { locationId },
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
      select: { id: true, name: true, requiredLevel: true },
    }),
    // Only the animal editor needs items, and a region page hides it.
    locationId
      ? []
      : prisma.item.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, sprite: true, rarity: true },
        }),
    getCombatConfig(),
    getStageOptions(),
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
    <>
      {locationId ? null : (
        <StatTiles
          stats={[
            { label: "Hunting grounds", value: grounds.length },
            { label: "Animals", value: creatures.length },
            {
              label: "Drop entries",
              value: creatures.reduce((sum, creature) => sum + creature.drops.length, 0),
            },
            {
              label: "Active durations",
              value: durations.filter((duration) => duration.enabled).length,
            },
          ]}
        />
      )}
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
        combatConfig={combatConfig}
        stages={stages}
        locationId={locationId}
      />
    </>
  );
}
