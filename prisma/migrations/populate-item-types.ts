/**
 * Script to populate itemType for existing items
 * Run with: npx tsx prisma/migrations/populate-item-types.ts
 */

import { PrismaClient, ItemType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Populating itemType for existing items...\n');

  // Update Health Potion (id: 36) - our stackable item
  await prisma.item.update({
    where: { id: 36 },
    data: {
      itemType: ItemType.POTION,
      equipTo: null,
      stackable: true,
      maxStackSize: 99,
    },
  });
  console.log('✅ Updated Health Potion (id: 36) - POTION, stackable, max 99');

  // Update weapons based on equipTo = 'WEAPON'
  const weapons = await prisma.item.findMany({
    where: { equipTo: 'WEAPON' },
  });

  for (const weapon of weapons) {
    let itemType: ItemType;

    // Determine weapon type from name
    if (weapon.name.toLowerCase().includes('sword')) {
      itemType = ItemType.SWORD;
    } else if (weapon.name.toLowerCase().includes('axe')) {
      itemType = ItemType.AXE;
    } else if (weapon.name.toLowerCase().includes('bow')) {
      itemType = ItemType.BOW;
    } else if (weapon.name.toLowerCase().includes('staff')) {
      itemType = ItemType.STAFF;
    } else if (weapon.name.toLowerCase().includes('dagger')) {
      itemType = ItemType.DAGGER;
    } else if (weapon.name.toLowerCase().includes('mace')) {
      itemType = ItemType.MACE;
    } else if (weapon.name.toLowerCase().includes('spear')) {
      itemType = ItemType.SPEAR;
    } else if (weapon.name.toLowerCase().includes('wand')) {
      itemType = ItemType.WAND;
    } else {
      itemType = ItemType.SWORD; // Default to sword
    }

    await prisma.item.update({
      where: { id: weapon.id },
      data: {
        itemType,
        stackable: false,
        maxStackSize: 1,
      },
    });
    console.log(`✅ Updated ${weapon.name} (id: ${weapon.id}) - ${itemType}`);
  }

  // Update armor pieces
  const armorSlotMapping: Record<string, ItemType> = {
    'HEAD': ItemType.HELMET,
    'CHEST': ItemType.CHESTPLATE,
    'LEGS': ItemType.LEGGINGS,
    'BOOTS': ItemType.BOOTS,
    'GLOVES': ItemType.GLOVES,
    'SHOULDERS': ItemType.SHOULDERS,
    'BELT': ItemType.BELT,
  };

  for (const [slot, type] of Object.entries(armorSlotMapping)) {
    const armorPieces = await prisma.item.findMany({
      where: { equipTo: slot },
    });

    for (const armor of armorPieces) {
      await prisma.item.update({
        where: { id: armor.id },
        data: {
          itemType: type,
          stackable: false,
          maxStackSize: 1,
        },
      });
      console.log(`✅ Updated ${armor.name} (id: ${armor.id}) - ${type}`);
    }
  }

  // Update accessories
  const accessorySlotMapping: Record<string, ItemType> = {
    'RING': ItemType.RING,
    'AMULET': ItemType.AMULET,
    'NECKLACE': ItemType.NECKLACE,
  };

  for (const [slot, type] of Object.entries(accessorySlotMapping)) {
    const accessories = await prisma.item.findMany({
      where: { equipTo: slot },
    });

    for (const accessory of accessories) {
      await prisma.item.update({
        where: { id: accessory.id },
        data: {
          itemType: type,
          stackable: false,
          maxStackSize: 1,
        },
      });
      console.log(`✅ Updated ${accessory.name} (id: ${accessory.id}) - ${type}`);
    }
  }

  // Update backpacks
  const backpacks = await prisma.item.findMany({
    where: { equipTo: 'BACKPACK' },
  });

  for (const backpack of backpacks) {
    await prisma.item.update({
      where: { id: backpack.id },
      data: {
        itemType: ItemType.BACKPACK,
        stackable: false,
        maxStackSize: 1,
      },
    });
    console.log(`✅ Updated ${backpack.name} (id: ${backpack.id}) - BACKPACK`);
  }

  console.log('\n✨ All items updated successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
