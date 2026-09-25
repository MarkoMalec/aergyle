import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { resetTrack, setTrackProgress } from "~/server/admin/playerEdits";
import {
  readBody,
  runEdit,
  trackEditSchema,
  trackResetSchema,
  type PlayerContext,
} from "../../schema";

/** A skill's (or other track's) level or XP, and a skill's lifetime totals. */
export async function PATCH(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, trackEditSchema);
  if ("response" in body) return body.response;
  return runEdit(() => setTrackProgress(params.id, body.data));
}

export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, trackResetSchema);
  if ("response" in body) return body.response;
  return runEdit(() => resetTrack(params.id, body.data));
}
