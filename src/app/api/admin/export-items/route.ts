import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

/**
 * Export all items from database as CSV with stat progressions
 * GET /api/admin/export-items
 * 
 * Format: One row per stat progression
 * Multiple rows for items with multiple stats
 * Items without stat progressions will have one row with empty stat fields
 */
export async function GET(req: NextRequest) {
  try {
    // Fetch all items with their base stats AND stat progressions
    const items = await prisma.item.findMany({
      include: {
        stats: true, // Base stats (ItemStat)
        statProgressions: true, // Progressive stats (ItemStatProgression)
      },
      orderBy: {
        id: 'asc',
      },
    });

    // CSV header
    const headers = [
      "name",
      "price",
      "sprite",
      "equipTo",
      "rarity",
      "minPhysicalDamage",
      "maxPhysicalDamage",
      "minMagicDamage",
      "maxMagicDamage",
      "armor",
      "requiredLevel",
      "statType",
      "baseValue",
      "unlocksAtRarity",
    ].join(",");

    // CSV rows - one row per stat (base or progression)
    const rows: string[] = [];
    
    for (const item of items) {
      // Base item data that repeats for each stat
      const baseData = [
        item.name,
        item.price,
        item.sprite,
        item.equipTo || "",
        item.rarity,
        item.minPhysicalDamage,
        item.maxPhysicalDamage,
        item.minMagicDamage,
        item.maxMagicDamage,
        item.armor,
        item.requiredLevel,
      ];

      let hasStats = false;

      // Add rows for base stats (from ItemStat - these always have "BASE" as unlock rarity)
      for (const stat of item.stats) {
        const row = [
          ...baseData,
          stat.statType,
          stat.value,
          "BASE", // Special marker for base stats (always active)
        ].join(",");
        rows.push(row);
        hasStats = true;
      }

      // Add rows for progressive stats (from ItemStatProgression)
      for (const statProg of item.statProgressions) {
        const row = [
          ...baseData,
          statProg.statType,
          statProg.baseValue,
          statProg.unlocksAtRarity,
        ].join(",");
        rows.push(row);
        hasStats = true;
      }

      // If item has no stats at all, create one row with empty stat fields
      if (!hasStats) {
        const row = [
          ...baseData,
          "", // statType
          "", // baseValue
          "", // unlocksAtRarity
        ].join(",");
        rows.push(row);
      }
    }

    // Combine header and rows
    const csv = [headers, ...rows].join("\n");

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="items-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export items", details: error },
      { status: 500 }
    );
  }
}
