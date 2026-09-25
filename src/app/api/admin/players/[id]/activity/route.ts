import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { cancelActivity, completeActivity } from "~/server/admin/playerEdits";
import { activitySchema, readBody, runEdit, type PlayerContext } from "../../schema";

/** Completes an activity now, or cancels it with nothing paid out. */
export async function POST(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, activitySchema);
  if ("response" in body) return body.response;
  const { kind, action } = body.data;
  return runEdit(() =>
    action === "complete"
      ? completeActivity(params.id, kind)
      : cancelActivity(params.id, kind),
  );
}
