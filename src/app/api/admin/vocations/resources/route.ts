import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  ItemRarity,
  ItemType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { getCraftingRule, validateCraftingItemTypes } from "~/game/crafting";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const requirementSchema = z.object({
  itemId: z.number().int().positive(),
  quantityPerUnit: z.number().int().min(1),
});

const VOCATIONAL_ACTION_TYPE_VALUES = Object.values(VocationalActionType) as [
  VocationalActionType,
  ...VocationalActionType[],
];

const ITEM_RARITY_VALUES = Object.values(ItemRarity) as [
  ItemRarity,
  ...ItemRarity[],
];

const resourceSchema = z
  .object({
    actionType: z.enum(VOCATIONAL_ACTION_TYPE_VALUES),
    name: z.string().min(1),
    itemId: z.number().int().positive(),
    requiredRecipeItemId: z.number().int().positive().nullable().default(null),
    requiredSkillLevel: z.number().int().min(1).default(1),
    defaultSeconds: z.number().int().min(1),
    yieldPerUnit: z.number().int().min(1),
    xpPerUnit: z.number().int().min(0),
    rarity: z.enum(ITEM_RARITY_VALUES),
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

export async function GET(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const resources = await prisma.vocationalResource.findMany({
    include: {
      requirements: true,
      item: true,
    },
    orderBy: [{ id: "desc" }],
    take: 500,
  });

  return NextResponse.json(resources);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = resourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const v = parsed.data;

  const craftingRule = getCraftingRule(v.actionType);
  if (
    (!craftingRule || !craftingRule.allowsLearnedRecipes) &&
    v.requiredRecipeItemId !== null
  ) {
    return NextResponse.json(
      { error: "This action does not support a learnable recipe gate" },
      { status: 400 },
    );
  }

  if (craftingRule) {
    if (v.requirements.length === 0) {
      return NextResponse.json(
        { error: `${craftingRule.label} recipes need at least one material` },
        { status: 400 },
      );
    }

    const referencedIds = Array.from(
      new Set([
        v.itemId,
        ...v.requirements.map((requirement) => requirement.itemId),
        ...(v.requiredRecipeItemId ? [v.requiredRecipeItemId] : []),
      ]),
    );
    const templates = await prisma.item.findMany({
      where: { id: { in: referencedIds } },
      select: { id: true, itemType: true },
    });
    const itemTypes = new Map(
      templates.map((template) => [template.id, template.itemType]),
    );

    const craftingError = validateCraftingItemTypes({
      actionType: v.actionType,
      outputType: itemTypes.get(v.itemId),
      inputTypes: v.requirements.map((requirement) =>
        itemTypes.get(requirement.itemId),
      ),
    });
    if (craftingError) {
      return NextResponse.json({ error: craftingError }, { status: 400 });
    }
    if (
      v.requiredRecipeItemId &&
      itemTypes.get(v.requiredRecipeItemId) !== ItemType.RECIPE
    ) {
      return NextResponse.json(
        {
          error: "Required recipe must be a RECIPE item template",
        },
        { status: 400 },
      );
    }
  }

  if (v.actionType === VocationalActionType.FISHING) {
    if (v.requirements.length > 1) {
      return NextResponse.json(
        { error: "Fishing can have at most 1 bait requirement" },
        { status: 400 },
      );
    }

    if (v.requirements.length === 1) {
      const baitTemplate = await prisma.item.findUnique({
        where: { id: v.requirements[0]!.itemId },
        select: { itemType: true },
      });
      if (!baitTemplate || baitTemplate.itemType !== ItemType.BAIT) {
        return NextResponse.json(
          { error: "Fishing requirements must be a BAIT item template" },
          { status: 400 },
        );
      }
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const resource = await tx.vocationalResource.create({
        data: {
          actionType: v.actionType,
          name: v.name,
          itemId: v.itemId,
          requiredRecipeItemId: v.requiredRecipeItemId,
          requiredSkillLevel: v.requiredSkillLevel,
          defaultSeconds: v.defaultSeconds,
          yieldPerUnit: v.yieldPerUnit,
          xpPerUnit: v.xpPerUnit,
          rarity: v.rarity,
        },
      });

      if (v.requirements.length > 0) {
        await tx.vocationalRequirement.createMany({
          data: v.requirements.map((r) => ({
            resourceId: resource.id,
            itemId: r.itemId,
            quantityPerUnit: r.quantityPerUnit,
          })),
        });
      }

      return resource;
    });

    return NextResponse.json(created);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "Failed to create resource (itemId must be unique; requirements must be valid items)",
      },
      { status: 400 },
    );
  }
}
