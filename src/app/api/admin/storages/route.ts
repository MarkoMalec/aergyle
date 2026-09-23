import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { readBody, saveError, storageSchema } from "../settlements/schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, storageSchema);
  if ("response" in body) return body.response;
  try {
    const storage = await prisma.settlementStorage.create({ data: body.data });
    return NextResponse.json({ ok: true, storage });
  } catch (error) {
    return saveError(error);
  }
}
