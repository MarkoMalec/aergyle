import { prisma } from '../src/lib/prisma';
import { getInventoryCapacity } from '../src/utils/inventoryCapacity';

async function main() {
  console.log('Fixing inventory slots to match capacity...\n');

  const inventories = await prisma.inventory.findMany({
    include: {
      User: {
        select: { id: true, name: true }
      }
    }
  });

  for (const inventory of inventories) {
    const capacity = await getInventoryCapacity(inventory.userId);
    const slots = inventory.slots as any[];
    
    console.log(`User: ${inventory.User.name}`);
    console.log(`  Current slots in DB: ${slots.length}`);
    console.log(`  Calculated capacity: ${capacity.max} (base: ${capacity.base}, bonus: ${capacity.bonus})`);
    
    if (slots.length > capacity.max) {
      // Truncate slots
      const truncatedSlots = slots.slice(0, capacity.max);
      await prisma.inventory.update({
        where: { userId: inventory.userId },
        data: { 
          slots: truncatedSlots,
          maxSlots: capacity.max
        }
      });
      console.log(`  ✓ Truncated from ${slots.length} to ${capacity.max} slots\n`);
    } else if (slots.length < capacity.max) {
      // Expand slots
      const expandedSlots = [...slots];
      while (expandedSlots.length < capacity.max) {
        expandedSlots.push({
          slotIndex: expandedSlots.length,
          item: null
        });
      }
      await prisma.inventory.update({
        where: { userId: inventory.userId },
        data: { 
          slots: expandedSlots,
          maxSlots: capacity.max
        }
      });
      console.log(`  ✓ Expanded from ${slots.length} to ${capacity.max} slots\n`);
    } else {
      // Just update maxSlots to match
      await prisma.inventory.update({
        where: { userId: inventory.userId },
        data: { maxSlots: capacity.max }
      });
      console.log(`  ✓ Already correct, updated maxSlots\n`);
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(console.error);
