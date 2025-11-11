import { prisma } from '../src/lib/prisma';
import { updateInventoryCapacity } from '../src/utils/inventoryCapacity';

async function main() {
  // Get all users
  const users = await prisma.user.findMany({
    select: { id: true, name: true }
  });

  console.log('Recalculating inventory capacity for all users...');

  for (const user of users) {
    console.log(`\nUser: ${user.name} (${user.id})`);
    const newCapacity = await updateInventoryCapacity(user.id);
    console.log(`Updated capacity to: ${newCapacity}`);
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main();
