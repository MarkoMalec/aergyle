import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { deleteUserQuest, setQuestCompleted } from "~/server/admin/playerEdits";
import {
  questRemoveSchema,
  questSchema,
  readBody,
  runEdit,
  type PlayerContext,
} from "../../schema";

/** Marks a taken quest complete (no rewards) or back in progress. */
export async function PATCH(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, questSchema);
  if ("response" in body) return body.response;
  const { userQuestId, completed } = body.data;
  return runEdit(() => setQuestCompleted(params.id, userQuestId, completed));
}

/** Forgets a quest for its period, so the player can take it again. */
export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, questRemoveSchema);
  if ("response" in body) return body.response;
  return runEdit(() => deleteUserQuest(params.id, body.data.userQuestId));
}
