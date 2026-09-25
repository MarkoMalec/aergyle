import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { grantStorage, removeStorage } from "~/server/admin/playerEdits";
import {
  readBody,
  runEdit,
  storageGrantSchema,
  storageRemoveSchema,
  type PlayerContext,
} from "../../schema";

/** Rents a settlement storage for the player, free. */
export async function POST(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, storageGrantSchema);
  if ("response" in body) return body.response;
  return runEdit(() => grantStorage(params.id, body.data.storageId));
}

/** Ends a rental and destroys what was kept in it. */
export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, storageRemoveSchema);
  if ("response" in body) return body.response;
  return runEdit(() => removeStorage(params.id, body.data.userStorageId));
}
