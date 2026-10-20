import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { listFriends } from "~/server/players";
import { respond } from "~/server/players/respond";

export const dynamic = "force-dynamic";

/** The player's friends and open requests. */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return respond(() => listFriends(session.user.id));
}
