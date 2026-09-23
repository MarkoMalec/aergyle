import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  readBody,
  saveError,
  storageConfigSchema,
} from "../../settlements/schema";

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, storageConfigSchema);
  if ("response" in body) return body.response;
  try {
    await prisma.storageConfig.upsert({
      where: { id: 1 },
      create: { id: 1, ...body.data },
      update: body.data,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
