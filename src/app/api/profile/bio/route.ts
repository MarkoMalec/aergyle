import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { updateBio } from "~/server/players";

export const dynamic = "force-dynamic";

/** Sets the player's own bio; an empty one clears it. */
export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    bio?: unknown;
  } | null;
  if (typeof body?.bio !== "string") {
    return NextResponse.json({ error: "Missing bio" }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateBio(session.user.id, body.bio));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save" },
      { status: 400 },
    );
  }
}
