import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { saveProject } from "~/server/settlements/projectAdmin";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { parseId, projectSchema, readBody, saveError } from "../../settlements/schema";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  const body = await readBody(request, projectSchema);
  if ("response" in body) return body.response;
  try {
    await saveProject(body.data, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}

// Content that required one of its stages becomes visible to everyone.
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
