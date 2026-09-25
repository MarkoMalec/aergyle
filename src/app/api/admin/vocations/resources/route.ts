import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { resourceSchema, validateResourceInput } from "./schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = resourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const v = parsed.data;

  const invalid = await validateResourceInput(v);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // New resources land at the bottom of their skill's list; /admin/vocations
      // is where the order gets rearranged.
      const lastInAction = await tx.vocationalResource.aggregate({
        where: { actionType: v.actionType },
        _max: { sortOrder: true },
      });

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
          sortOrder: (lastInAction._max.sortOrder ?? 0) + 10,
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
