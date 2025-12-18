import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

// Minimal endpoint for selecting resources.
// Later we can filter by location, requirements, etc.
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resources = await prisma.vocationalResource.findMany({
    select: {
      id: true,
      actionType: true,
      name: true,
      itemId: true,
      defaultSeconds: true,
      yieldPerUnit: true,
      xpPerUnit: true,
      rarity: true,
    },
    orderBy: [{ actionType: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ resources });
}
