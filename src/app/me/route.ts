import { redirect } from "next/navigation";
import { getServerAuthSession } from "~/server/auth";
import { prisma } from "~/lib/prisma";
import { playerProfileHref } from "~/game/players";

export const dynamic = "force-dynamic";

/**
 * The signed-in player's own profile, /@Name. Sign-in can't know the name
 * beforehand, so it lands here and is sent on. The redirect is a bare path:
 * behind the proxy, request.url names the container (0.0.0.0:3000), not the
 * site.
 */
export async function GET() {
  const session = await getServerAuthSession();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      })
    : null;
  redirect(user ? playerProfileHref(user.name) : "/play");
}
