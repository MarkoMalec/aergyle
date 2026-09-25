import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { clearGardenTile, growGardenTile } from "~/server/admin/playerEdits";
import { readBody, runEdit, tileSchema, type PlayerContext } from "../../schema";

/** Makes a planted tile ready to harvest now. */
export async function PATCH(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, tileSchema);
  if ("response" in body) return body.response;
  return runEdit(() => growGardenTile(params.id, body.data.tileId));
}

/** Clears a tile, destroying its crop. */
export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, tileSchema);
  if ("response" in body) return body.response;
  return runEdit(() => clearGardenTile(params.id, body.data.tileId));
}
