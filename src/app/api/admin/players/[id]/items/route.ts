import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { grantItem } from "~/server/admin/playerEdits";
import { grantSchema, readBody, runEdit, type PlayerContext } from "../../schema";

/** Gives the player items, as many as fit in their bag. */
export async function POST(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, grantSchema);
  if ("response" in body) return body.response;
  return runEdit(() => grantItem(params.id, body.data));
}
