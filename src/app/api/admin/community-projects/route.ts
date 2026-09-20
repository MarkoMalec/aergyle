import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { projectSchema, readBody, saveError } from "../settlements/schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, projectSchema);
  if ("response" in body) return body.response;
  const { requirements, ...project } = body.data;
  try {
    const created = await prisma.communityProject.create({
      data: { ...project, requirements: { create: requirements } },
    });
    return NextResponse.json({ ok: true, project: created });
  } catch (error) {
    return saveError(error);
  }
}
