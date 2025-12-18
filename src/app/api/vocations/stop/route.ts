import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { stopVocationalActivity } from "~/server/vocations";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Stop is delete-only; server will auto-grant any earned units.
  const status = await stopVocationalActivity({ userId: session.user.id });
  return NextResponse.json(status);
}
