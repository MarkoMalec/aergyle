import Link from "next/link";
import { ItemRarity, VocationalActionType } from "~/generated/prisma/enums";
import { GatheringAdminClient } from "~/components/admin/gathering/GatheringAdminClient";
import { prisma } from "~/lib/prisma";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminGatheringPage() {
  await requireAdminPageAccess();
  const [locations, resources, assignments, durations, rarityConfigs] =
    await Promise.all([
      prisma.location.findMany({ orderBy: { name: "asc" } }),
      prisma.vocationalResource.findMany({
        where: { actionType: VocationalActionType.GATHERING },
        orderBy: [{ requiredSkillLevel: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          itemId: true,
          requiredSkillLevel: true,
          rarity: true,
          item: { select: { name: true, sprite: true } },
        },
      }),
      prisma.locationVocationalResource.findMany({
        where: {
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
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gathering Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Balance location availability, resource pools, find chances,
            quantities, level gates, rarity, duration scaling, and rewards.
          </p>
          <p className="mt-2 text-xs text-white/50">
            Player Luck, Gathering level, and active bonuses are applied by the
            reward engine on top of these base values.
          </p>
        </div>
        <Link
          href="/skills/Gathering"
          className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
        >
          Open player page
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">{locations.length}</div>
          <div className="text-xs text-white/50">World locations</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">
            {locations.filter((location) => location.gatheringEnabled).length}
          </div>
          <div className="text-xs text-white/50">Gathering enabled</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">{resources.length}</div>
          <div className="text-xs text-white/50">Gatherable resources</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gray-900/35 p-3">
          <div className="text-2xl font-semibold">
            {durations.filter((duration) => duration.enabled).length}
          </div>
          <div className="text-xs text-white/50">Active durations</div>
        </div>
      </div>

      <GatheringAdminClient
        locations={locationRows}
        resources={resources}
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
      />
    </div>
  );
}
