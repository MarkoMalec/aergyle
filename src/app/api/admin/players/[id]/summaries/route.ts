import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { queueDemoSummary } from "~/server/admin/playerEdits";
import { runEdit, type PlayerContext } from "../../schema";

/** Queues a sample "while you were away" summary for the player's next visit. */
export async function POST(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  return runEdit(() => queueDemoSummary(params.id));
}
