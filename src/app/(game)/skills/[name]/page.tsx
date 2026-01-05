import React from "react";
import { prisma } from "~/lib/prisma";

import { notFound } from "next/navigation";
import SkillVocationalResources from "~/components/game/vocations/SkillVocationalResources";
import { getServerAuthSession } from "~/server/auth";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";
import {
  computeEffectiveUnitSeconds,
  getToolEfficiencyForAction,
} from "~/server/vocations/tools";

export async function generateMetadata({ params }: { params: { name: string } }) {
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

export async function generateStaticParams() {
  const skills = await prisma.skills.findMany();
  return skills.map((skill) => ({
    name: skill.skill_name,
  }));
}

const SkillPage = async ({ params }: { params: { name: string } }) => {
  const skill = await prisma.skills.findUnique({
    where: {
      skill_name: params.name,
    },
  });

  if (!skill) {
    notFound();
  }

  const actionType = toVocationalActionTypeFromSkillName(skill.skill_name);

  const session = await getServerAuthSession();
  const currentLocationId = session?.user?.id
    ? (
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { currentLocationId: true },
        })
      )?.currentLocationId ?? null
    : null;

  const resources = actionType
    ? await prisma.vocationalResource.findMany({
        where:
          currentLocationId === null
            ? { actionType }
            : {
                actionType,
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
          requiredSkillLevel: true,
          defaultSeconds: true,
          yieldPerUnit: true,
          xpPerUnit: true,
          item: { select: { sprite: true } },
          requirements: {
            select: {
              quantityPerUnit: true,
              item: { select: { id: true, name: true, sprite: true } },
            },
            orderBy: [{ id: "asc" }],
          },
        },
        orderBy: [{ id: "asc" }],
      })
    : [];

  const userId = session?.user?.id ?? null;
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
      {/* <div>
        <h1 className="text-2xl font-semibold">{skill.skill_name}</h1>
        {skill.description ? (
          <p className="text-sm text-white/70">{skill.description}</p>
        ) : null}
      </div> */}

      {actionType ? (
        <SkillVocationalResources resources={resourcesWithEfficiency} />
      ) : (
        <div className="text-sm text-white/70">
          No vocational actions for this skill yet.
        </div>
      )}
    </main>
  );
};

export default SkillPage;
