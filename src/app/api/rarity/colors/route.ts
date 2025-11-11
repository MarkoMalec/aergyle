import { NextResponse } from "next/server";
import { getRarityColorsFromDB } from "~/utils/rarity";

export const dynamic = 'force-dynamic';

/**
 * GET /api/rarity/colors
 * Returns rarity color mapping from database
 * Used by client components to display accurate rarity colors
 */
export async function GET() {
  try {
    const colors = await getRarityColorsFromDB();
    
    return NextResponse.json({
      colors,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("Failed to fetch rarity colors:", error);
    return NextResponse.json(
      { error: "Failed to fetch rarity colors" },
      { status: 500 }
    );
  }
}
