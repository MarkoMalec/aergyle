  // seed.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const userId = 'clx1qko3x00006x4k0umisx5w'; // Replace with the actual user ID

  // Create 5 random items
  const items = await Promise.all([
    prisma.item.create({
      data: {
        name: 'Bronze Dagger',
        stat1: 'AD:2-5',
        stat2: 'AS:1.5',
        price: 10.0,
      },
    }),
    prisma.item.create({
      data: {
        name: 'Silver Sword',
        stat1: 'AD:5-10',
        stat2: 'AS:1.2',
        price: 20.0,
      },
    }),
    prisma.item.create({
      data: {
        name: 'Golden Axe',
        stat1: 'AD:10-20',
        stat2: 'AS:0.8',
        price: 30.0,
      },
    }),
    prisma.item.create({
      data: {
        name: 'Iron Mace',
        stat1: 'AD:7-14',
        stat2: 'AS:1.0',
        price: 25.0,
      },
    }),
    prisma.item.create({
      data: {
        name: 'Steel Bow',
        stat1: 'AD:3-6',
        stat2: 'AS:1.7',
        price: 15.0,
      },
    }),
  ]);

  // Create inventory slots as JSON
  const slots = Array.from({ length: 20 }, (_, index) => ({
    slotIndex: index,
    item: index < items.length ? items[index] : null,
  }));

  // Update or create the user's inventory
  await prisma.inventory.upsert({
    where: { userId },
    update: { slots: JSON.stringify(slots) },
    create: {
      userId,
      slots: JSON.stringify(slots),
      maxSlots: 20,
    },
  });

  console.log('Seeding completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

