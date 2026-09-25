import { NextResponse, type NextRequest } from "next/server";
import { initializeRarityConfigs } from "~/utils/rarity";
import { requireAdminApiAccess } from "~/server/admin/auth";

export async function POST(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  try {
    await initializeRarityConfigs();
    return NextResponse.json({ success: true, message: "Rarity configs initialized" });
  } catch (error) {
    console.error("Error initializing rarity configs:", error);
    return NextResponse.json(
      { error: "Failed to initialize rarity configs" },
      { status: 500 }
    );
  }
}
