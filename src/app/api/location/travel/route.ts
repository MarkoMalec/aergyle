import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const locationId = body?.locationId;

  if (typeof locationId !== "number") {
    return NextResponse.json({ error: "locationId is required" }, { status: 400 });
  }

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true },
  });

  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { currentLocationId: locationId },
  });

  return NextResponse.json({ ok: true, currentLocationId: locationId });
}
