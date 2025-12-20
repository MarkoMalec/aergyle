import React from "react";
import { prisma } from "~/lib/prisma";

import { notFound } from "next/navigation";
import SkillVocationalResources from "~/components/game/vocations/SkillVocationalResources";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";

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
  const resources = actionType
    ? await prisma.vocationalResource.findMany({
        where: { actionType },
        select: {
          id: true,
          name: true,
          defaultSeconds: true,
          yieldPerUnit: true,
          xpPerUnit: true,
          item: { select: { sprite: true } },
        },
        orderBy: [{ id: "asc" }],
      })
    : [];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{skill.skill_name}</h1>
        {skill.description ? (
          <p className="text-sm text-white/70">{skill.description}</p>
        ) : null}
      </div>

      {actionType ? (
        <SkillVocationalResources resources={resources} />
      ) : (
        <div className="text-sm text-white/70">
          No vocational actions for this skill yet.
        </div>
      )}
    </main>
  );
};

export default SkillPage;
