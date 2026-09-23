import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  parseId,
  readBody,
  saveError,
  storageSchema,
} from "../../settlements/schema";

type Context = { params: { id: string } };

// A storage stays in the settlement it was made for.
const patchSchema = storageSchema.omit({ settlementId: true });

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id)
    return NextResponse.json({ error: "Invalid storage" }, { status: 400 });
  const body = await readBody(request, patchSchema);
  if ("response" in body) return body.response;
  try {
    await prisma.settlementStorage.update({ where: { id }, data: body.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}

// Removes every player's storage here, and everything they kept in it.
export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id)
    return NextResponse.json({ error: "Invalid storage" }, { status: 400 });
  try {
    await prisma.settlementStorage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
