import { NextResponse } from "next/server";
import { VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import {
  computeEffectiveUnitSeconds,
  getToolEfficiencyForAction,
} from "~/server/vocations/tools";

// Minimal endpoint for selecting resources.
// Later we can filter by location, requirements, etc.
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currentLocationId: true },
  });

  const currentLocationId = user?.currentLocationId ?? null;

  const resources = await prisma.vocationalResource.findMany({
    where:
      currentLocationId === null
        ? undefined
        : {
            locations: {
              some: {
                locationId: currentLocationId,
                enabled: true,
              },
            },
          },
    select: {
      id: true,
      actionType: true,
      name: true,
      itemId: true,
      defaultSeconds: true,
      yieldPerUnit: true,
      xpPerUnit: true,
      rarity: true,
    },
    orderBy: [{ actionType: "asc" }, { id: "asc" }],
  });

  const actionTypes = Array.from(
    new Set(resources.map((resource) => resource.actionType as VocationalActionType)),
  );

  let efficiencyByAction: Partial<Record<VocationalActionType, number>> = {};
  if (session.user?.id && actionTypes.length > 0) {
    const entries = await Promise.all(
      actionTypes.map(async (actionType) => {
        const value = await getToolEfficiencyForAction(session.user!.id, actionType);
        return [actionType, value] as const;
      }),
    );
    efficiencyByAction = Object.fromEntries(entries);
  }

  const enrichedResources = resources.map((resource) => {
    const actionType = resource.actionType as VocationalActionType;
    const efficiency = efficiencyByAction[actionType] ?? 0;
    const { unitSeconds } = computeEffectiveUnitSeconds(
      resource.defaultSeconds,
      efficiency,
    );

    return {
      ...resource,
      effectiveSeconds: unitSeconds,
      appliedEfficiency: efficiency,
    };
  });

  return NextResponse.json({ resources: enrichedResources, currentLocationId });
}
