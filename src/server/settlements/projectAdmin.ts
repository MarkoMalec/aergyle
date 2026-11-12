import "server-only";

import type { ProjectInput } from "~/app/api/admin/settlements/schema";
import { prisma } from "~/lib/prisma";
import { syncProjectStages } from "./projects";

/**
 * Creates a project (no id) or saves one with all its stages. Stages are kept
 * by id, so their progress, rewards and unlocked content survive edits; a
 * removed stage takes its progress along and its content becomes visible.
 * Requirements are matched by item for the same reason.
 */
export async function saveProject(input: ProjectInput, id?: number) {
  const { stages, startsAt, endsAt, ...fields } = input;
  const data = {
    ...fields,
    // A schedule counts rounds from its start, so it always gets one.
    startsAt: startsAt
      ? new Date(startsAt)
      : fields.repeat === "SCHEDULE"
        ? new Date()
        : null,
    endsAt: endsAt ? new Date(endsAt) : null,
  };
  return prisma.$transaction(async (tx) => {
    const project = id
      ? await tx.communityProject.update({ where: { id }, data, select: { id: true } })
      : await tx.communityProject.create({ data, select: { id: true } });

    const kept = stages.flatMap((stage) => (stage.id ? [stage.id] : []));
    await tx.communityProjectStage.deleteMany({
      where: { projectId: project.id, id: { notIn: kept } },
    });
    // Park positions first so reordering never trips the (project, position) key.
    await tx.communityProjectStage.updateMany({
      where: { projectId: project.id },
      data: { position: { increment: 1_000 } },
    });

    for (const [index, stage] of stages.entries()) {
      const { id: stageId, requirements, rewardItems, effects, ...stageFields } = stage;
      const row = { ...stageFields, position: index + 1 };
      const saved = stageId
        ? await tx.communityProjectStage.update({
            // projectId in the filter: a stage id from another project fails.
            where: { id: stageId, projectId: project.id },
            data: row,
            select: { id: true },
          })
        : await tx.communityProjectStage.create({
            data: { ...row, projectId: project.id },
            select: { id: true },
          });

      await tx.communityProjectRequirement.deleteMany({
        where: { stageId: saved.id, itemId: { notIn: requirements.map((r) => r.itemId) } },
      });
      for (const { itemId, quantity } of requirements) {
        await tx.communityProjectRequirement.upsert({
          where: { stageId_itemId: { stageId: saved.id, itemId } },
          create: { stageId: saved.id, itemId, quantity },
          update: { quantity },
        });
      }
      await tx.communityProjectRewardItem.deleteMany({ where: { stageId: saved.id } });
      await tx.communityProjectRewardItem.createMany({
        data: rewardItems.map((reward) => ({ ...reward, stageId: saved.id })),
      });
      await tx.communityProjectEffect.deleteMany({ where: { stageId: saved.id } });
      await tx.communityProjectEffect.createMany({
        data: effects
          .filter((effect) => effect.value > 0)
          .map((effect) => ({ ...effect, stageId: saved.id })),
      });
    }
    await syncProjectStages(tx, project.id);
    return project;
  });
}
