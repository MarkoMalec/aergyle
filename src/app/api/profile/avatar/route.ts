import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPlayerAvatarById } from "~/lib/player-avatars";
import { prisma } from "~/lib/prisma";
import { authOptions } from "~/server/auth";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const avatarId =
    typeof body === "object" && body !== null && "avatarId" in body
      ? body.avatarId
      : null;
  const avatar =
    typeof avatarId === "string" ? getPlayerAvatarById(avatarId) : undefined;

  if (!avatar) {
    return NextResponse.json({ error: "Unknown avatar" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: avatar.src },
    select: { id: true },
  });

  return NextResponse.json({ avatar });
}
