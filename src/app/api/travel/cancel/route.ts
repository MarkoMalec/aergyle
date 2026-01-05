import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { cancelTravel } from "~/server/travel/service";

export async function POST() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await cancelTravel(session.user.id);
  return NextResponse.json({ ok: true });
}
