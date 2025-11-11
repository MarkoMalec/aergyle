import { prisma } from "~/lib/prisma";

/**
 * Update all existing inventories to have base 25 slots
 * Run this once after implementing CARRYING_CAPACITY system
 */

async function updateInventoriesToBase25() {
  console.log("🔧 Updating all inventories to base capacity of 25 slots...\n");

  // Get all inventories
  const inventories = await prisma.inventory.findMany({
    select: {
      id: true,
      userId: true,
      maxSlots: true,
      slots: true,
    },
  });

  console.log(`Found ${inventories.length} inventories to update\n`);

  let updated = 0;
  let skipped = 0;

  for (const inventory of inventories) {
    const currentSlots = (inventory.slots as any[]) || [];
    const currentMaxSlots = inventory.maxSlots;

    // If already 25 or more, skip
    if (currentMaxSlots >= 25) {
      console.log(`✓ User ${inventory.userId}: Already has ${currentMaxSlots} slots (skipped)`);
      skipped++;
      continue;
    }

    // Expand slots array to 25 if needed
    const newSlots = [...currentSlots];
    while (newSlots.length < 25) {
      newSlots.push({ slotIndex: newSlots.length, item: null });
    }

    // Update inventory
    await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        maxSlots: 25,
        slots: newSlots,
      },
    });

    console.log(`✅ User ${inventory.userId}: Updated from ${currentMaxSlots} to 25 slots`);
    updated++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${inventories.length}`);
  console.log(`\n✨ Done! All inventories now have base 25 slots.`);
  console.log(`📝 Note: Equipping backpacks with CARRYING_CAPACITY will add bonus slots.`);
}

// Run if executed directly
// if (require.main === module) {
  updateInventoriesToBase25()
    .then(() => {
      console.log("\n✅ Migration complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
// }

export { updateInventoriesToBase25 };
