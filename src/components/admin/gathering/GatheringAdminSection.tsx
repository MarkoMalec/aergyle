import { ItemRarity, VocationalActionType } from "~/generated/prisma/enums";
import { StatTiles } from "~/components/admin/fields";
import { GatheringAdminClient } from "~/components/admin/gathering/GatheringAdminClient";
import { prisma } from "~/lib/prisma";

/** Gathering editor for the whole game, or only one region's pool when locationId is set. */
export async function GatheringAdminSection({
  locationId,
}: {
  locationId?: number;
}) {
  const [locations, resources, assignments, durations, rarityConfigs] =
    await Promise.all([
      prisma.location.findMany({
        where: { id: locationId },
        orderBy: { name: "asc" },
      }),
      prisma.vocationalResource.findMany({
        where: { actionType: VocationalActionType.GATHERING },
        orderBy: [{ requiredSkillLevel: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          itemId: true,
          requiredSkillLevel: true,
          item: { select: { name: true, sprite: true, rarity: true } },
        },
      }),
      prisma.locationVocationalResource.findMany({
        where: {
          locationId,
          resource: { actionType: VocationalActionType.GATHERING },
        },
        select: {
          locationId: true,
          resourceId: true,
          enabled: true,
          gatheringBaseChance: true,
          gatheringMinQuantity: true,
          gatheringMaxQuantity: true,
        },
      }),
      prisma.gatheringDuration.findMany({
        orderBy: [{ sortOrder: "asc" }, { durationSeconds: "asc" }],
      }),
      prisma.rarityConfig.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

  const assignmentByKey = new Map(
    assignments.map((assignment) => [
      `${assignment.locationId}:${assignment.resourceId}`,
      assignment,
    ]),
  );
  const locationRows = locations.map((location) => ({
    id: location.id,
    name: location.name,
    requiredLevel: location.requiredLevel,
    gatheringEnabled: location.gatheringEnabled,
    gatheringRequiredLevel: location.gatheringRequiredLevel,
    resources: resources.map((resource) => {
      const assignment = assignmentByKey.get(`${location.id}:${resource.id}`);
      return {
        resourceId: resource.id,
        enabled: assignment?.enabled ?? false,
        baseChance: assignment?.gatheringBaseChance ?? 0.25,
        minQuantity: assignment?.gatheringMinQuantity ?? 1,
        maxQuantity: assignment?.gatheringMaxQuantity ?? 1,
      };
    }),
  }));

  const configuredRarities = new Map(
    rarityConfigs.map((config) => [
      config.rarity,
      {
        value: config.rarity,
        label: config.displayName,
        color: config.color,
      },
    ]),
  );
  const rarities = Object.values(ItemRarity).map(
    (rarity) =>
      configuredRarities.get(rarity) ?? {
        value: rarity,
        label: rarity
          .toLowerCase()
          .replaceAll("_", " ")
          .replace(/^./, (letter) => letter.toUpperCase()),
        color: "#ffffff",
      },
  );

  return (
    <>
      {locationId ? null : (
        <StatTiles
          stats={[
            { label: "World locations", value: locations.length },
            {
              label: "Gathering enabled",
              value: locations.filter((location) => location.gatheringEnabled).length,
            },
            { label: "Gatherable resources", value: resources.length },
            {
              label: "Active durations",
              value: durations.filter((duration) => duration.enabled).length,
            },
          ]}
        />
      )}
      <GatheringAdminClient
        locations={locationRows}
        resources={resources.map((resource) => ({
          ...resource,
          rarity: resource.item.rarity,
        }))}
        durations={durations.map((duration) => ({
          id: duration.id,
          label: duration.label,
          durationSeconds: duration.durationSeconds,
          rewardRolls: duration.rewardRolls,
          quantityMultiplier: Number(duration.quantityMultiplier),
          xpReward: duration.xpReward,
          requiredGatheringLevel: duration.requiredGatheringLevel,
          enabled: duration.enabled,
          sortOrder: duration.sortOrder,
        }))}
        rarities={rarities}
        locationId={locationId}
      />
    </>
  );
}
