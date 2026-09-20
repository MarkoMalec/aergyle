import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { syncProjectCompletion } from "~/server/settlements";
import { parseId, projectSchema, readBody, saveError } from "../../settlements/schema";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  const body = await readBody(request, projectSchema);
  if ("response" in body) return body.response;
  const { requirements, ...project } = body.data;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.communityProject.update({ where: { id }, data: project });
      // Requirements are matched by item so contributions are kept; a
      // removed item's contributions go with it.
      await tx.communityProjectRequirement.deleteMany({
        where: {
          projectId: id,
          itemId: { notIn: requirements.map((row) => row.itemId) },
        },
      });
      for (const { itemId, quantity } of requirements) {
        await tx.communityProjectRequirement.upsert({
          where: { projectId_itemId: { projectId: id, itemId } },
          create: { projectId: id, itemId, quantity },
          update: { quantity },
        });
      }
      await syncProjectCompletion(tx, id);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}

// Content that required this project becomes visible to everyone.
export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  try {
    await prisma.communityProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
