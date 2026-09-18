import React from "react";
import { prisma } from "~/lib/prisma";

import { notFound } from "next/navigation";
import SkillVocationalResources from "~/components/game/vocations/SkillVocationalResources";
import Garden from "~/components/game/garden/Garden";
import GatheringExpedition from "~/components/game/gathering/GatheringExpedition";
import HuntingExpedition from "~/components/game/hunting/HuntingExpedition";
import { getServerAuthSession } from "~/server/auth";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";
import {
  computeEffectiveUnitSeconds,
  getToolEfficiencyForAction,
} from "~/server/vocations/tools";
import { getCraftingRule } from "~/game/crafting";

// Recipe visibility and location availability are character-specific.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isGatheringSkillParam(name: string) {
  return name.trim().toLowerCase() === "gathering";
}

function isGardeningSkillParam(name: string) {
  return name.trim().toLowerCase() === "gardening";
}

function isHuntingSkillParam(name: string) {
  return name.trim().toLowerCase() === "hunting";
}

export async function generateMetadata({
  params,
}: {
  params: { name: string };
}) {
  if (isGardeningSkillParam(params.name)) {
    return {
      title: "Gardening",
      description: "Plant seeds, wait for crops to grow, and harvest them.",
    };
  }
  if (isGatheringSkillParam(params.name)) {
    return {
      title: "Gathering",
      description:
        "Send your character on expeditions for a varied resource haul.",
    };
  }
  if (isHuntingSkillParam(params.name)) {
    return {
      title: "Hunting",
      description:
        "Track animals through local grounds and return with useful materials.",
    };
  }

  const skill = await prisma.skills.findUnique({
    where: {
      skill_name: params.name,
    },
  });

  if (!skill) {
    return {
      title: "Skill Not Found",
    };
  }

  return {
    title: skill.skill_name,
    description: skill.description ?? undefined,
  };
}

const SkillPage = async ({ params }: { params: { name: string } }) => {
  if (isGardeningSkillParam(params.name)) {
    return (
      <main className="space-y-6">
        <Garden />
      </main>
    );
  }

  if (isGatheringSkillParam(params.name)) {
    return (
      <main className="space-y-6">
        <GatheringExpedition />
      </main>
    );
  }

  if (isHuntingSkillParam(params.name)) {
    return (
      <main className="space-y-6">
        <HuntingExpedition />
      </main>
    );
  }

  const skill = await prisma.skills.findUnique({
    where: {
      skill_name: params.name,
    },
  });

  if (!skill) {
    notFound();
  }

  const actionType = toVocationalActionTypeFromSkillName(skill.skill_name);
  const craftingRule = actionType ? getCraftingRule(actionType) : null;

  const session = await getServerAuthSession();
  const userId = session?.user?.id ?? null;
  const currentLocationId = session?.user?.id
    ? (
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { currentLocationId: true },
        })
      )?.currentLocationId ?? null
    : null;

  const learnedRecipeItemIds =
    userId && craftingRule?.allowsLearnedRecipes
      ? (
          await prisma.userLearnedRecipe.findMany({
            where: { userId },
            select: { recipeItemId: true },
          })
        ).map((recipe) => recipe.recipeItemId)
      : [];

  const resources = actionType
    ? await prisma.vocationalResource.findMany({
        where: {
          actionType,
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
          ...(craftingRule?.allowsLearnedRecipes
            ? {
                OR: [
                  { requiredRecipeItemId: null },
                  { requiredRecipeItemId: { in: learnedRecipeItemIds } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          actionType: true,
          name: true,
          requiredSkillLevel: true,
          defaultSeconds: true,
          yieldPerUnit: true,
          xpPerUnit: true,
          rarity: true,
          item: { select: { id: true, sprite: true, itemType: true } },
          requirements: {
            select: {
              quantityPerUnit: true,
              item: {
                select: {
                  id: true,
                  name: true,
                  sprite: true,
                  itemType: true,
                  rarity: true,
                },
              },
            },
            orderBy: [{ id: "asc" }],
          },
        },
        orderBy: [{ id: "asc" }],
      })
    : [];

  const appliedEfficiency =
    userId && actionType
      ? await getToolEfficiencyForAction(userId, actionType)
      : 0;

  const resourcesWithEfficiency = resources.map((resource) => {
    const { unitSeconds } = computeEffectiveUnitSeconds(
      resource.defaultSeconds,
      appliedEfficiency,
    );

    return {
      ...resource,
      effectiveSeconds: unitSeconds,
      appliedEfficiency,
    };
  });

  return (
    <main className="space-y-6">
      {actionType ? (
        <SkillVocationalResources
          resources={resourcesWithEfficiency}
          actionType={actionType}
        />
      ) : (
        <div className="text-sm text-muted-foreground">
          No vocational actions for this skill yet.
        </div>
      )}
    </main>
  );
};

export default SkillPage;
