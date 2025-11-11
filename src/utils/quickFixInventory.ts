import { prisma } from "~/lib/prisma";

/**
 * Quick fix: Manually set inventory to use the LATEST UserItem IDs
 */
async function quickFix() {
  console.log("🔧 Quick fix: Setting inventory to latest UserItems\n");

  const userId = "cmhm30v1s000027ilctzj5dge"; // Your user ID

  // Get the most recent UserItems for this user
  const userItems = await prisma.userItem.findMany({
    where: { userId },
    orderBy: { id: "desc" },
    take: 20,
    include: {
      itemTemplate: true,
    },
  });

  console.log(`Found ${userItems.length} UserItems:`);
  userItems.forEach((ui) => {
    console.log(
      `  UserItem ${ui.id}: ${ui.itemTemplate.name} (${ui.rarity})`
    );
  });

  // Use the most recent ones in inventory
  const slots = Array.from({ length: 20 }, (_, index) => {
    const userItem = userItems[index];
    return {
      slotIndex: index,
      item: userItem ? { id: userItem.id } : null,
    };
  });

  await prisma.inventory.update({
    where: { userId },
    data: {
      slots: slots as any,
    },
  });

  console.log("\n✅ Inventory updated with latest UserItems!");
}

quickFix()
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
