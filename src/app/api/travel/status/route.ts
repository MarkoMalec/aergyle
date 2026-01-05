import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getTravelStatus } from "~/server/travel/service";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getTravelStatus(session.user.id);
  return NextResponse.json(status);
}
