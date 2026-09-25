import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  addXpMultiplier,
  removeFoodEffect,
  removeXpMultiplier,
  setFoodEffect,
} from "~/server/admin/playerEdits";
import {
  effectRemoveSchema,
  effectSchema,
  readBody,
  runEdit,
  type PlayerContext,
} from "../../schema";

/** Starts a timed food effect, or adds an XP multiplier. */
export async function POST(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, effectSchema);
  if ("response" in body) return body.response;
  const effect = body.data;
  return runEdit(() =>
    effect.type === "food"
      ? setFoodEffect(params.id, effect)
      : addXpMultiplier(params.id, effect),
  );
}

export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, effectRemoveSchema);
  if ("response" in body) return body.response;
  const removal = body.data;
  return runEdit(() =>
    removal.type === "food"
      ? removeFoodEffect(params.id)
      : removeXpMultiplier(params.id, removal.id),
  );
}
