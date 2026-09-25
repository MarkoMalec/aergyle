import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { setStatBonuses } from "~/server/admin/playerEdits";
import { readBody, runEdit, statsSchema, type PlayerContext } from "../../schema";

/** Replaces the character's own stat additions on top of their level. */
export async function PATCH(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, statsSchema);
  if ("response" in body) return body.response;
  return runEdit(() => setStatBonuses(params.id, body.data.stats));
}
