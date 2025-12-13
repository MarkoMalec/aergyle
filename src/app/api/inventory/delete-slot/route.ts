import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { deleteSlotId } = await req.json();

    await prisma.inventory.update({
      where: { userId },
      data: { deleteSlotId },
    });

    return NextResponse.json(
      { message: "Delete slot updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating delete slot:", error);
    return NextResponse.json(
      { error: "Failed to update delete slot" },
      { status: 500 }
    );
  }
}
