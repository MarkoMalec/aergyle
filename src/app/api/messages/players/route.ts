import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { findPlayers } from "~/server/communication";

export const dynamic = "force-dynamic";

/** Players to write to, matched by name. */
export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const query = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({
    players: await findPlayers(session.user.id, query),
  });
}
