import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { cancelBuyOrder } from "~/server/admin/playerEdits";
import { buyOrderSchema, readBody, runEdit, type PlayerContext } from "../../schema";

/** Cancels an open buy order, returning its reserved gold or not. */
export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, buyOrderSchema);
  if ("response" in body) return body.response;
  const { orderId, refund } = body.data;
  return runEdit(() => cancelBuyOrder(params.id, orderId, refund));
}
