import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { restartProjectRound } from "~/server/settlements";
import { parseId, saveError } from "../../../settlements/schema";

// Starts a fresh round now: this round's progress is wiped, rewards stay.
export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  try {
    await restartProjectRound(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
