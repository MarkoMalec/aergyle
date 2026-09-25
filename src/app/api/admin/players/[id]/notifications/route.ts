import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { deleteNotifications } from "~/server/admin/playerEdits";
import {
  notificationSchema,
  readBody,
  runEdit,
  type PlayerContext,
} from "../../schema";

/** Deletes one notification, or all of them when no id is given. */
export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, notificationSchema);
  if ("response" in body) return body.response;
  return runEdit(() => deleteNotifications(params.id, body.data.id));
}
