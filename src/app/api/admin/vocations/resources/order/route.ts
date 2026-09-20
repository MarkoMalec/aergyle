import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { VocationalActionType } from "~/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VOCATIONAL_ACTION_TYPE_VALUES = Object.values(VocationalActionType) as [
  VocationalActionType,
  ...VocationalActionType[],
];

// Ordering is per action type: a resource only competes for a slot with the
// other resources of its own skill.
const schema = z
  .object({
    actionType: z.enum(VOCATIONAL_ACTION_TYPE_VALUES),
    resourceIds: z.array(z.number().int().positive()).min(1),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.resourceIds).size !== v.resourceIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate resource id",
        path: ["resourceIds"],
      });
    }
  });

export async function PATCH(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { actionType, resourceIds } = parsed.data;

  const owned = await prisma.vocationalResource.count({
    where: { id: { in: resourceIds }, actionType },
  });
  if (owned !== resourceIds.length) {
    return NextResponse.json(
      { error: `Every resource must belong to ${actionType}` },
      { status: 400 },
    );
  }

  // Spaced by 10 so a later insert can land between two rows.
  await prisma.$transaction(
    resourceIds.map((id, index) =>
      prisma.vocationalResource.update({
        where: { id },
        data: { sortOrder: (index + 1) * 10 },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
