import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { prisma } from "~/lib/prisma";
import { playerProfileHref } from "~/game/players";

export const dynamic = "force-dynamic";

/**
 * The signed-in player's own profile, /@Name. Sign-in can't know the name
 * beforehand, so it lands here and is sent on.
 */
export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      })
    : null;
  const to = user ? playerProfileHref(user.name) : "/play";
  return NextResponse.redirect(new URL(to, request.url));
}
