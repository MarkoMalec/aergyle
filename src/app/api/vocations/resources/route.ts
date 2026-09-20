import { NextResponse } from "next/server";
import { VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import {
  computeEffectiveUnitSeconds,
  getToolEfficiencyMap,
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

  const learnedRecipeItemIds = (
    await prisma.userLearnedRecipe.findMany({
      where: { userId: session.user.id },
      select: { recipeItemId: true },
    })
  ).map((recipe) => recipe.recipeItemId);

  const resources = await prisma.vocationalResource.findMany({
    where: {
      ...(currentLocationId === null
        ? {}
        : {
            locations: {
              some: {
                locationId: currentLocationId,
                enabled: true,
              },
            },
          }),
      OR: [
        { requiredRecipeItemId: null },
        { requiredRecipeItemId: { in: learnedRecipeItemIds } },
      ],
    },
    select: {
      id: true,
      actionType: true,
      name: true,
      itemId: true,
      requiredSkillLevel: true,
      defaultSeconds: true,
      yieldPerUnit: true,
      xpPerUnit: true,
      rarity: true,
      item: { select: { sprite: true, itemType: true } },
      requirements: {
        select: {
          quantityPerUnit: true,
          item: {
            select: { id: true, name: true, sprite: true, itemType: true },
          },
        },
        orderBy: [{ id: "asc" }],
      },
    },
    orderBy: [{ actionType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  const actionTypes = Array.from(
    new Set(
      resources.map((resource) => resource.actionType as VocationalActionType),
    ),
  );

  let efficiencyByAction: Partial<Record<VocationalActionType, number>> = {};
  if (session.user?.id && actionTypes.length > 0) {
    efficiencyByAction = await getToolEfficiencyMap(
      session.user.id,
      actionTypes,
    );
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
