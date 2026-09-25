import { NextResponse, type NextRequest } from "next/server";
import { loadEquipmentWithItems } from "~/utils/inventory";
import { getServerAuthSession } from "~/server/auth";

export const dynamic = "force-dynamic";

// Equipping and unequipping are saved through POST /api/inventory, together
// with the bag slots they move items to and from.
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const equipmentWithItems = await loadEquipmentWithItems(userId);

    return NextResponse.json(equipmentWithItems, { status: 200 });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
