import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  deleteItem,
  moveItemToBag,
  updateItem,
} from "~/server/admin/playerEdits";
import { itemSchema, parseItemId, readBody, runEdit } from "../../../schema";

type Context = { params: { id: string; userItemId: string } };

const invalid = () =>
  NextResponse.json({ error: "Invalid item" }, { status: 400 });

/** Quantity, rarity, tradeability and per-item stat modifiers. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const userItemId = parseItemId(params.userItemId);
  if (!userItemId) return invalid();
  const body = await readBody(request, itemSchema);
  if ("response" in body) return body.response;
  return runEdit(() => updateItem(params.id, userItemId, body.data));
}

/** Moves the item back into the player's bag from wherever it is. */
export async function POST(request: NextRequest, { params }: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const userItemId = parseItemId(params.userItemId);
  if (!userItemId) return invalid();
  return runEdit(() => moveItemToBag(params.id, userItemId));
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const userItemId = parseItemId(params.userItemId);
  if (!userItemId) return invalid();
  return runEdit(() => deleteItem(params.id, userItemId));
}
