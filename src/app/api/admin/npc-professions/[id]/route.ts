import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  parseId,
  professionSchema,
  readBody,
  saveError,
} from "../../settlements/schema";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid profession" }, { status: 400 });
  }
  const body = await readBody(request, professionSchema);
  if ("response" in body) return body.response;
  try {
    await prisma.npcProfession.update({ where: { id }, data: body.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}

// NPCs with this profession keep everything else and have none afterwards.
export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid profession" }, { status: 400 });
  }
  try {
    await prisma.npcProfession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
