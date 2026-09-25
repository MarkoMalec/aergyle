import Link from "next/link";
import React from "react";
import { prisma } from "~/lib/prisma";
import { VocationalActionType } from "~/generated/prisma/enums";
import {
  SkillItemRulesSection,
  type SkillRuleUsage,
} from "~/components/admin/vocations/SkillItemRulesEditor";
import { skillHoldsResources } from "~/game/crafting";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { getSkillItemRules } from "~/server/vocations/skillRules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminVocationRulesPage() {
  await requireAdminPageAccess();
  const [itemRules, resources] = await Promise.all([
    getSkillItemRules(),
    prisma.vocationalResource.findMany({
      select: {
        actionType: true,
        item: { select: { itemType: true } },
        requirements: { select: { item: { select: { itemType: true } } } },
      },
    }),
  ]);

  const usage = new Map<VocationalActionType, SkillRuleUsage>();
  const resourceCounts = new Map<VocationalActionType, number>();
  for (const resource of resources) {
    let skillUsage = usage.get(resource.actionType);
    if (!skillUsage) {
      skillUsage = { outputs: {}, inputs: {} };
      usage.set(resource.actionType, skillUsage);
    }
    const outputType = resource.item.itemType;
    if (outputType) {
      skillUsage.outputs[outputType] =
        (skillUsage.outputs[outputType] ?? 0) + 1;
    }
    // Counted once per resource, however many requirements share the type.
    const inputTypes = new Set(
      resource.requirements.flatMap((requirement) =>
        requirement.item.itemType ? [requirement.item.itemType] : [],
      ),
    );
    for (const inputType of Array.from(inputTypes)) {
      skillUsage.inputs[inputType] = (skillUsage.inputs[inputType] ?? 0) + 1;
    }
    resourceCounts.set(
      resource.actionType,
      (resourceCounts.get(resource.actionType) ?? 0) + 1,
    );
  }

  const skills = Object.values(VocationalActionType)
    .filter(skillHoldsResources)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vocation Item Rules</h1>
          <p className="text-sm text-white/70">
            Choose which item types each skill&apos;s resources can output and
            consume. A list with nothing ticked accepts every item type. The
            number on a type is how many of the skill&apos;s resources use it
            today.
          </p>
        </div>
        <Link
          href="/admin/vocations"
          className="shrink-0 text-sm text-white/70 hover:text-white"
        >
          Back
        </Link>
      </div>

      <div className="space-y-4">
        {skills.map((skill) => (
          <SkillItemRulesSection
            key={skill}
            actionType={skill}
            rule={itemRules[skill]}
            usage={usage.get(skill) ?? { outputs: {}, inputs: {} }}
            resourceCount={resourceCounts.get(skill) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
