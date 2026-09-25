import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { deleteConversation, deleteMessage } from "~/server/admin/playerEdits";
import { messageSchema, readBody, runEdit, type PlayerContext } from "../../schema";

/** Deletes a whole conversation (for both players) or a single message. */
export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, messageSchema);
  if ("response" in body) return body.response;
  const target = body.data;
  return runEdit(() =>
    "conversationId" in target
      ? deleteConversation(params.id, target.conversationId)
      : deleteMessage(params.id, target.messageId),
  );
}
