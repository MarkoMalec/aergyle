import { prisma } from "~/lib/prisma";
import { slotsToInputJson } from "~/utils/inventorySlots";

/**
 * EMERGENCY: Restore inventory to original format
 * This will restore the JSON to use Item template IDs (not UserItem IDs)
 */
async function restoreInventory() {
  console.log("🚨 EMERGENCY RESTORE: Reverting inventory to original format...\n");

  const users = await prisma.user.findMany({
    where: {
      inventory: {
        isNot: null,
      },
    },
    include: {
      inventory: true,
    },
  });

  for (const user of users) {
    if (!user.inventory) continue;

    console.log(`👤 Restoring inventory for: ${user.name || user.id}`);

    // Get all UserItems for this user
    const userItems = await prisma.userItem.findMany({
      where: { userId: user.id },
      include: {
        itemTemplate: true,
      },
    });

    if (userItems.length === 0) {
      console.log(`  ℹ️  No UserItems found, setting empty inventory`);
      
      // Create empty slots
      const emptySlots = Array.from({ length: 20 }, (_, index) => ({
        slotIndex: index,
        item: null,
      }));

      await prisma.inventory.update({
        where: { id: user.inventory.id },
        data: {
          slots: slotsToInputJson(emptySlots),
        },
      });
      continue;
    }

    console.log(`  📦 Found ${userItems.length} UserItems, adding to inventory...`);

    // Create slots with Item template IDs (original format)
    const slots = Array.from({ length: 20 }, (_, index) => {
      const userItem = userItems[index];
      return {
        slotIndex: index,
        item: userItem ? { id: userItem.itemId } : null, // Use itemId (template ID)
      };
    });

    await prisma.inventory.update({
      where: { id: user.inventory.id },
      data: {
        slots: slotsToInputJson(slots),
      },
    });

    console.log(`  ✅ Restored ${userItems.length} items to inventory\n`);
  }

  console.log("✅ Emergency restore complete!");
}

// Run the restore
restoreInventory()
  .catch((error) => {
    console.error("Restore failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
