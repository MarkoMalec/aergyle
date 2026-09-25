import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { deletePlayer, updatePlayer } from "~/server/admin/playerEdits";
import { playerSchema, readBody, runEdit, type PlayerContext } from "../schema";

/** Account and character fields: name, email, password, gold, level, location, health. */
export async function PATCH(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, playerSchema);
  if ("response" in body) return body.response;
  return runEdit(() => updatePlayer(params.id, body.data));
}

/** Deletes the account and everything it owns. */
export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  return runEdit(() => deletePlayer(params.id));
}
