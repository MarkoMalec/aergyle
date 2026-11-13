import { z } from "zod";
import type { Prisma } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import {
  ItemType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { getResourceSkillConflict } from "~/game/crafting";
import { getSkillItemRules } from "~/server/vocations/skillRules";

const requirementSchema = z.object({
  itemId: z.number().int().positive(),
  quantityPerUnit: z.number().int().min(1),
});

const VOCATIONAL_ACTION_TYPE_VALUES = Object.values(VocationalActionType) as [
  VocationalActionType,
  ...VocationalActionType[],
];

export const resourceSchema = z
  .object({
    actionType: z.enum(VOCATIONAL_ACTION_TYPE_VALUES),
    name: z.string().min(1),
    itemId: z.number().int().positive(),
    requiredRecipeItemId: z.number().int().positive().nullable().default(null),
    requiredSkillLevel: z.number().int().min(1).default(1),
    defaultSeconds: z.number().int().min(1),
    yieldPerUnit: z.number().int().min(1),
    xpPerUnit: z.number().int().min(0),
    requirements: z.array(requirementSchema).default([]),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<number>();
    for (const r of v.requirements) {
      if (seen.has(r.itemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate requirement item",
          path: ["requirements"],
        });
        break;
      }
      seen.add(r.itemId);
    }
  });

/**
 * Checks a resource against its skill's rules (getResourceSkillConflict), which
 * need the referenced item templates. Returns the error to show, or null.
 */
export async function validateResourceInput(
  v: z.infer<typeof resourceSchema>,
): Promise<string | null> {
  const referencedIds = Array.from(
    new Set([
      v.itemId,
      ...v.requirements.map((requirement) => requirement.itemId),
      ...(v.requiredRecipeItemId ? [v.requiredRecipeItemId] : []),
    ]),
  );
  const [templates, itemRules] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: referencedIds } },
      select: { id: true, itemType: true },
    }),
    getSkillItemRules(),
  ]);
  const itemTypes = new Map(
    templates.map((template) => [template.id, template.itemType]),
  );

  const conflict = getResourceSkillConflict({
    actionType: v.actionType,
    outputType: itemTypes.get(v.itemId),
    requirementTypes: v.requirements.map((requirement) =>
      itemTypes.get(requirement.itemId),
    ),
    hasRecipeGate: v.requiredRecipeItemId !== null,
    itemRules,
  });
  if (conflict) {
    return conflict;
  }
  if (
    v.requiredRecipeItemId &&
    itemTypes.get(v.requiredRecipeItemId) !== ItemType.RECIPE
  ) {
    return "Required recipe must be a RECIPE item template";
  }

  return null;
}

/**
 * The sortOrder for a resource joining `actionType`'s list by required level:
 * right after the last row (in the current, possibly hand-arranged order) whose
 * level is at or below it. Later rows shift down; the order is renumbered 10, 20, …
 */
export async function levelSortOrder(
  tx: Prisma.TransactionClient,
  actionType: VocationalActionType,
  requiredSkillLevel: number,
  excludeId?: number,
) {
  const rows = await tx.vocationalResource.findMany({
    where: { actionType, id: excludeId ? { not: excludeId } : undefined },
    select: { id: true, requiredSkillLevel: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  let index = 0;
  rows.forEach((row, i) => {
    if (row.requiredSkillLevel <= requiredSkillLevel) index = i + 1;
  });
  for (const [i, row] of rows.entries()) {
    const sortOrder = (i < index ? i + 1 : i + 2) * 10;
    if (row.sortOrder !== sortOrder) {
      await tx.vocationalResource.update({
        where: { id: row.id },
        data: { sortOrder },
      });
    }
  }
  return (index + 1) * 10;
}
