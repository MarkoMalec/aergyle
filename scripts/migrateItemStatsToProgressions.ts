import { prisma } from "../src/lib/prisma";

/**
 * Migrate existing ItemStat records to ItemStatProgression
 * This converts the old 2-stat system to the new progression system
 */
async function main() {
  console.log("Starting migration: ItemStat → ItemStatProgression\n");

  // Get all items with their old stats
  const items = await prisma.item.findMany({
    include: {
      stats: true,
      statProgressions: true,
    },
  });

  console.log(`Found ${items.length} items\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    console.log(`\n📦 ${item.name} (${item.equipTo || "consumable"})`);

    // Skip if already has stat progressions
    if (item.statProgressions.length > 0) {
      console.log(`  ⏭️  Already has ${item.statProgressions.length} stat progression(s) - skipping`);
      skippedCount++;
      continue;
    }

    // Skip if no stats to migrate
    if (item.stats.length === 0) {
      console.log(`  ⏭️  No stats to migrate - skipping`);
      skippedCount++;
      continue;
    }

    // Create stat progressions from old stats
    console.log(`  ✓ Found ${item.stats.length} old stat(s) to migrate`);
    
    for (const stat of item.stats) {
      await prisma.itemStatProgression.create({
        data: {
          itemId: item.id,
          statType: stat.statType,
          baseValue: stat.value,
          unlocksAtRarity: "COMMON", // Default to unlocking immediately
        },
      });

      console.log(`    → Migrated ${stat.statType}: ${stat.value} (unlocks at COMMON)`);
    }

    migratedCount++;
  }

  console.log("\n" + "=".repeat(50));
  console.log("Migration Complete!");
  console.log("=".repeat(50));
  console.log(`✅ Migrated: ${migratedCount} items`);
  console.log(`⏭️  Skipped: ${skippedCount} items`);
  console.log("\nNote: Old ItemStat records were NOT deleted.");
  console.log("You can delete them manually if you want to clean up.");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
