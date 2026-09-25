import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { VocationalActionType } from "~/generated/prisma/enums";
import { getResourceSkillConflict } from "~/game/crafting";
import { getSkillItemRules } from "~/server/vocations/skillRules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VOCATIONAL_ACTION_TYPE_VALUES = Object.values(VocationalActionType) as [
  VocationalActionType,
  ...VocationalActionType[],
];

// Each group is a skill's complete resource list, in display order, as it
// should be after saving. A resource listed under another skill than its
// current one moves there; nothing else about it changes.
const schema = z
  .object({
    groups: z
      .array(
        z.object({
          actionType: z.enum(VOCATIONAL_ACTION_TYPE_VALUES),
          resourceIds: z.array(z.number().int().positive()),
        }),
      )
      .min(1),
  })
  .superRefine((v, ctx) => {
    const actionTypes = v.groups.map((group) => group.actionType);
    if (new Set(actionTypes).size !== actionTypes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate action type",
        path: ["groups"],
      });
    }
    const ids = v.groups.flatMap((group) => group.resourceIds);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate resource id",
        path: ["groups"],
      });
    }
  });

class LayoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const body: unknown = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { groups } = parsed.data;
  const targetById = new Map<number, VocationalActionType>();
  for (const group of groups) {
    for (const id of group.resourceIds) targetById.set(id, group.actionType);
  }

  const itemRules = await getSkillItemRules();

  try {
    const moved = await prisma.$transaction(
      async (tx) => {
        const resources = await tx.vocationalResource.findMany({
          where: {
            OR: [
              { id: { in: Array.from(targetById.keys()) } },
              { actionType: { in: groups.map((group) => group.actionType) } },
            ],
          },
          select: {
            id: true,
            name: true,
            actionType: true,
            sortOrder: true,
            requiredRecipeItemId: true,
            item: { select: { itemType: true } },
            requirements: { select: { item: { select: { itemType: true } } } },
          },
        });
        const byId = new Map(
          resources.map((resource) => [resource.id, resource]),
        );

        if (Array.from(targetById.keys()).some((id) => !byId.has(id))) {
          throw new LayoutError(
            "A resource on this page no longer exists. Reload and try again.",
            409,
          );
        }
        // A resource created (or moved) in another tab since this page loaded
        // would be left out of the new order; make the admin see it first.
        const unlisted = resources.find(
          (resource) => !targetById.has(resource.id),
        );
        if (unlisted) {
          throw new LayoutError(
            `${unlisted.name} was added to ${unlisted.actionType} since this page loaded. Reload and try again.`,
            409,
          );
        }

        let movedCount = 0;
        for (const group of groups) {
          for (const [index, id] of group.resourceIds.entries()) {
            const resource = byId.get(id)!;
            const moves = resource.actionType !== group.actionType;
            if (moves) {
              const conflict = getResourceSkillConflict({
                actionType: group.actionType,
                outputType: resource.item.itemType,
                requirementTypes: resource.requirements.map(
                  (requirement) => requirement.item.itemType,
                ),
                hasRecipeGate: resource.requiredRecipeItemId !== null,
                itemRules,
              });
              if (conflict) {
                throw new LayoutError(
                  `${resource.name} cannot move to ${group.actionType}: ${conflict}`,
                  400,
                );
              }
              movedCount += 1;
            }

            // Spaced by 10 so a later insert can land between two rows.
            const sortOrder = (index + 1) * 10;
            if (!moves && resource.sortOrder === sortOrder) continue;
            await tx.vocationalResource.update({
              where: { id },
              data: { actionType: group.actionType, sortOrder },
            });
          }
        }
        return movedCount;
      },
      // One round trip per changed row; the dev DB is ~60 ms away.
      { timeout: 30_000 },
    );

    return NextResponse.json({ ok: true, moved });
  } catch (error) {
    if (error instanceof LayoutError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
