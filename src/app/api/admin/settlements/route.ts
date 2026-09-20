import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { readBody, saveError, settlementSchema } from "./schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, settlementSchema);
  if ("response" in body) return body.response;
  try {
    const settlement = await prisma.settlement.create({ data: body.data });
    return NextResponse.json({ ok: true, settlement });
  } catch (error) {
    return saveError(error);
  }
}
