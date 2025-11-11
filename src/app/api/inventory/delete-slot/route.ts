import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, deleteSlotId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

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
