import type { NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { forgetRecipe, learnRecipe } from "~/server/admin/playerEdits";
import { readBody, recipeSchema, runEdit, type PlayerContext } from "../../schema";

export async function POST(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, recipeSchema);
  if ("response" in body) return body.response;
  return runEdit(() => learnRecipe(params.id, body.data.itemId));
}

export async function DELETE(request: NextRequest, { params }: PlayerContext) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, recipeSchema);
  if ("response" in body) return body.response;
  return runEdit(() => forgetRecipe(params.id, body.data.itemId));
}
