import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { saveProject } from "~/server/settlements/projectAdmin";
import { projectSchema, readBody, saveError } from "../settlements/schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, projectSchema);
  if ("response" in body) return body.response;
  try {
    const project = await saveProject(body.data);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return saveError(error);
  }
}
