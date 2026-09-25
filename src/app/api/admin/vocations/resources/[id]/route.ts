import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { resourceSchema, validateResourceInput } from "../schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

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
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.vocationalResource.findUniqueOrThrow({
        where: { id },
        select: { actionType: true },
      });
      // A resource moved to another skill joins the bottom of that skill's
      // list, like a new one; its old sortOrder means nothing there.
      const sortOrder =
        current.actionType === v.actionType
          ? undefined
          : ((
              await tx.vocationalResource.aggregate({
                where: { actionType: v.actionType },
                _max: { sortOrder: true },
              })
            )._max.sortOrder ?? 0) + 10;

      const resource = await tx.vocationalResource.update({
        where: { id },
        data: {
          sortOrder,
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

      await tx.vocationalRequirement.deleteMany({ where: { resourceId: id } });

      if (v.requirements.length > 0) {
        await tx.vocationalRequirement.createMany({
          data: v.requirements.map((r) => ({
            resourceId: id,
            itemId: r.itemId,
            quantityPerUnit: r.quantityPerUnit,
          })),
        });
      }

      return resource;
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "Failed to update resource (itemId must be unique; requirements must be valid items)",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.vocationalResource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          "Failed to delete resource (it may be referenced by activities or locations)",
      },
      { status: 400 },
    );
  }
}
