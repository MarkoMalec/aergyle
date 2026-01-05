import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      currentLocationId: true,
      currentLocation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    currentLocationId: user?.currentLocationId ?? null,
    location: user?.currentLocation ?? null,
  });
}
