import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function giveItemsToUser(userId) {
  // Define the item IDs you want to give
  const itemIds = [1, 2, 3, 4, 5];

  try {
    // Fetch the items by their IDs
    const items = await prisma.item.findMany({
      where: {
        id: {
          in: itemIds,
        },
      },
    });

    // Fetch the user's current inventory
    const userInventory = await prisma.inventory.findUnique({
      where: {
        userId: userId,
      },
    });

    // Check if inventory exists for the user
    if (!userInventory) {
      throw new Error('User inventory not found');
    }

    // Parse the current slots
    let currentSlots = JSON.parse(userInventory.slots);

    // Ensure slots are correctly structured and filter out invalid entries
    currentSlots = currentSlots.filter(slot => typeof slot === 'object' && slot.slotIndex !== undefined);

    // Assign items to the first available slots
    items.forEach(item => {
      for (let i = 0; i < userInventory.maxSlots; i++) {
        if (!currentSlots[i].item) {
          currentSlots[i].item = item;
          break;
        }
      }
    });

    // Update the user's inventory with the new items
    await prisma.inventory.update({
      where: {
        userId: userId,
      },
      data: {
        slots: JSON.stringify(currentSlots),
      },
    });

    console.log('Items added to inventory successfully');
  } catch (error) {
    console.error('Error adding items to inventory:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Example usage
giveItemsToUser('clx1qko3x00006x4k0umisx5w');
