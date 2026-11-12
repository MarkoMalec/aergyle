import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  npcRevealSchema,
  parseId,
  readBody,
  saveError,
} from "../../../settlements/schema";

type Context = { params: { id: string } };

// Sets which community project stage reveals an NPC (null: always visible),
// from the project editor.
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid NPC" }, { status: 400 });
  const body = await readBody(request, npcRevealSchema);
  if ("response" in body) return body.response;
  try {
    await prisma.npc.update({
      where: { id },
      data: { requiredStageId: body.data.stageId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
