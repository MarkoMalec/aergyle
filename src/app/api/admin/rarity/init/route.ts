import { NextResponse } from "next/server";
import { initializeRarityConfigs } from "~/utils/rarity";

export async function POST() {
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
