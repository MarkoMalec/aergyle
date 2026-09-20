import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { parseId, readBody, saveError, settlementSchema } from "../schema";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid settlement" }, { status: 400 });
  const body = await readBody(request, settlementSchema);
  if ("response" in body) return body.response;
  try {
    await prisma.settlement.update({ where: { id }, data: body.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}

// Removes its NPCs (with shops, quests and quest progress) and its projects.
export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid settlement" }, { status: 400 });
  try {
    await prisma.settlement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
