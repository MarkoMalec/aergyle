import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  npcMoveSchema,
  parseId,
  readBody,
  saveError,
} from "../../../settlements/schema";

type Context = { params: { id: string } };

// Moves an NPC from the NPCs board. Its map pin belongs to the old
// settlement's map, so the NPC starts unplaced on the new one.
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid NPC" }, { status: 400 });
  const body = await readBody(request, npcMoveSchema);
  if ("response" in body) return body.response;
  try {
    await prisma.npc.update({
      where: { id },
      data: { settlementId: body.data.settlementId, mapX: null, mapY: null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
