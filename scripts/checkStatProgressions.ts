import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Checking stat progressions in database...\n');
  
  const items = await prisma.item.findMany({
    include: {
      statProgressions: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  console.log(`Total items: ${items.length}\n`);
  
  let itemsWithStats = 0;
  let itemsWithoutStats = 0;

  for (const item of items) {
    if (item.statProgressions.length > 0) {
      itemsWithStats++;
      console.log(`✓ ${item.name} (${item.equipTo || 'consumable'})`);
      item.statProgressions.forEach(stat => {
        console.log(`  - ${stat.statType}: ${stat.baseValue} (unlocks at ${stat.unlocksAtRarity})`);
      });
      console.log('');
    } else {
      itemsWithoutStats++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Items WITH stat progressions: ${itemsWithStats}`);
  console.log(`Items WITHOUT stat progressions: ${itemsWithoutStats}`);
  
  await prisma.$disconnect();
}

main();
