import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { ItemType, VocationalActionType } from "~/generated/prisma/enums";
import {
  type SkillItemRule,
  skillHoldsResources,
  sortItemTypes,
} from "~/game/crafting";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Empty lists accept every item type.
const schema = z.object({
  outputTypes: z.array(z.nativeEnum(ItemType)),
  inputTypes: z.array(z.nativeEnum(ItemType)),
});

// Existing resources are not re-checked: a narrower rule applies to one the
// next time it is saved or moved.
export async function PUT(
  req: NextRequest,
  ctx: { params: { actionType: string } },
) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const actionType = z
    .nativeEnum(VocationalActionType)
    .safeParse(ctx.params.actionType);
  if (!actionType.success || !skillHoldsResources(actionType.data)) {
    return NextResponse.json({ error: "Unknown skill" }, { status: 400 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const rule: SkillItemRule = {
    outputTypes: sortItemTypes(parsed.data.outputTypes),
    inputTypes: sortItemTypes(parsed.data.inputTypes),
  };
  const data = {
    outputItemTypes: rule.outputTypes,
    inputItemTypes: rule.inputTypes,
  };
  await prisma.vocationalSkillRule.upsert({
    where: { actionType: actionType.data },
    create: { actionType: actionType.data, ...data },
    update: data,
  });

  return NextResponse.json(rule);
}
