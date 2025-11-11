import { PrismaClient, ItemRarity, StatType } from '@prisma/client';
import { calculateRarityStats } from '../src/utils/rarity';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing items and stats
  await prisma.itemStat.deleteMany({});
  await prisma.item.deleteMany({});

  console.log('🗑️  Cleared existing items and stats');

  // Helper function to create item with stats
  async function createItemWithStats(
    itemData: {
      name: string;
      price: number;
      sprite: string;
      equipTo: string | null;
      rarity: ItemRarity;
      requiredLevel: number;
    },
    stats: Array<{ statType: StatType; value: number }>
  ) {
    // Apply rarity multiplier to base stats
    const rarityAdjustedStats = calculateRarityStats(stats, itemData.rarity);

    // Calculate denormalized columns
    const statsMap = new Map(rarityAdjustedStats.map((s) => [s.statType, s.value]));

    const item = await prisma.item.create({
      data: {
        ...itemData,
        minPhysicalDamage: statsMap.get(StatType.PHYSICAL_DAMAGE_MIN) || 0,
        maxPhysicalDamage: statsMap.get(StatType.PHYSICAL_DAMAGE_MAX) || 0,
        minMagicDamage: statsMap.get(StatType.MAGIC_DAMAGE_MIN) || 0,
        maxMagicDamage: statsMap.get(StatType.MAGIC_DAMAGE_MAX) || 0,
        armor: statsMap.get(StatType.ARMOR) || 0,
        stats: {
          create: rarityAdjustedStats,
        },
      },
      include: {
        stats: true,
      },
    });

    console.log(`✅ Created: ${item.name} (${item.rarity})`);
    return item;
  }

  // ============================================
  // WEAPONS
  // ============================================

  await createItemWithStats(
    {
      name: 'Wooden Sword',
      price: 50,
      sprite: '/assets/items/weapons/wooden-sword.jpg',
      equipTo: 'weapon',
      rarity: ItemRarity.COMMON,
      requiredLevel: 1,
    },
    [
      { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 3 },
      { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 7 },
      { statType: StatType.ATTACK_SPEED, value: 1.2 },
    ]
  );

  await createItemWithStats(
    {
      name: 'Wooden Dagger',
      price: 45,
      sprite: '/assets/items/weapons/wooden-dagger.jpg',
      equipTo: 'weapon',
      rarity: ItemRarity.COMMON,
      requiredLevel: 1,
    },
    [
      { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 2 },
      { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 5 },
      { statType: StatType.ATTACK_SPEED, value: 1.5 },
      { statType: StatType.CRITICAL_CHANCE, value: 5 },
    ]
  );

  await createItemWithStats(
    {
      name: 'Wooden Axe',
      price: 60,
      sprite: '/assets/items/weapons/wooden-axe.png',
      equipTo: 'weapon',
      rarity: ItemRarity.COMMON,
      requiredLevel: 1,
    },
    [
      { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 5 },
      { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 10 },
      { statType: StatType.ATTACK_SPEED, value: 0.9 },
    ]
  );

  await createItemWithStats(
    {
      name: 'Wooden Mace',
      price: 55,
      sprite: '/assets/items/weapons/wooden-mace.jpg',
      equipTo: 'weapon',
      rarity: ItemRarity.COMMON,
      requiredLevel: 1,
    },
    [
      { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 4 },
      { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 8 },
      { statType: StatType.ATTACK_SPEED, value: 1.0 },
      { statType: StatType.ARMOR, value: 2 },
    ]
  );

  await createItemWithStats(
    {
      name: 'Silver Revolver',
      price: 250,
      sprite: '/assets/items/weapons/silver-revolver.jpeg',
      equipTo: 'weapon',
      rarity: ItemRarity.RARE,
      requiredLevel: 5,
    },
    [
      { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 15 },
      { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 25 },
      { statType: StatType.ATTACK_SPEED, value: 1.8 },
      { statType: StatType.CRITICAL_CHANCE, value: 10 },
      { statType: StatType.ACCURACY, value: 15 },
    ]
  );

  await createItemWithStats(
    {
      name: 'Iron Shield',
      price: 180,
      sprite: '/assets/items/weapons/iron-shield.jpg',
      equipTo: 'weapon',
      rarity: ItemRarity.UNCOMMON,
      requiredLevel: 3,
    },
    [
      { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 1 },
      { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 3 },
      { statType: StatType.ARMOR, value: 25 },
      { statType: StatType.BLOCK_CHANCE, value: 15 },
      { statType: StatType.HEALTH, value: 50 },
    ]
  );

  // ============================================
  // ARMOR - HEAD
  // ============================================

  await createItemWithStats(
    {
      name: 'Gold Helmet',
      price: 200,
      sprite: '/assets/items/armor/gold-helmet.jpg',
      equipTo: 'head',
      rarity: ItemRarity.UNCOMMON,
      requiredLevel: 5,
    },
    [
      { statType: StatType.ARMOR, value: 15 },
      { statType: StatType.HEALTH, value: 30 },
      { statType: StatType.MAGIC_RESIST, value: 5 },
    ]
  );

  // ============================================
  // ARMOR - CHEST
  // ============================================

  await createItemWithStats(
    {
      name: 'Gold Chestplate',
      price: 300,
      sprite: '/assets/items/armor/gold-chest.jpg',
      equipTo: 'chest',
      rarity: ItemRarity.UNCOMMON,
      requiredLevel: 5,
    },
    [
      { statType: StatType.ARMOR, value: 30 },
      { statType: StatType.HEALTH, value: 60 },
      { statType: StatType.HEALTH_REGEN, value: 2 },
    ]
  );

  // ============================================
  // ARMOR - SHOULDERS
  // ============================================

  await createItemWithStats(
    {
      name: 'Dragonscale Shoulder Pads',
      price: 450,
      sprite: '/assets/items/armor/dragonscale-shoulder-pads.jpeg',
      equipTo: 'shoulders',
      rarity: ItemRarity.RARE,
      requiredLevel: 8,
    },
    [
      { statType: StatType.ARMOR, value: 20 },
      { statType: StatType.FIRE_RESIST, value: 15 },
      { statType: StatType.HEALTH, value: 40 },
      { statType: StatType.CRITICAL_DAMAGE, value: 10 },
    ]
  );

  // ============================================
  // ARMOR - GLOVES
  // ============================================

  await createItemWithStats(
    {
      name: 'Gold Gloves',
      price: 180,
      sprite: '/assets/items/armor/gold-gloves.jpg',
      equipTo: 'gloves',
      rarity: ItemRarity.UNCOMMON,
      requiredLevel: 5,
    },
    [
      { statType: StatType.ARMOR, value: 10 },
      { statType: StatType.ATTACK_SPEED, value: 0.1 },
      { statType: StatType.ACCURACY, value: 8 },
      { statType: StatType.CRITICAL_CHANCE, value: 3 },
    ]
  );

  // ============================================
  // ARMOR - BOOTS
  // ============================================

  await createItemWithStats(
    {
      name: 'Gold Boots',
      price: 180,
      sprite: '/assets/items/armor/gold-boots.jpg',
      equipTo: 'boots',
      rarity: ItemRarity.UNCOMMON,
      requiredLevel: 5,
    },
    [
      { statType: StatType.ARMOR, value: 12 },
      { statType: StatType.MOVEMENT_SPEED, value: 10 },
      { statType: StatType.EVASION_MELEE, value: 5 },
      { statType: StatType.HEALTH, value: 25 },
    ]
  );

  // ============================================
  // ARMOR - BELT
  // ============================================

  await createItemWithStats(
    {
      name: 'Leather Belt',
      price: 100,
      sprite: '/assets/items/armor/leather-belt.jpg',
      equipTo: 'belt',
      rarity: ItemRarity.COMMON,
      requiredLevel: 3,
    },
    [
      { statType: StatType.ARMOR, value: 5 },
      { statType: StatType.HEALTH, value: 40 },
      { statType: StatType.HEALTH_REGEN, value: 1 },
    ]
  );

  // ============================================
  // JEWELRY - RINGS
  // ============================================

  await createItemWithStats(
    {
      name: 'Gold Ring',
      price: 150,
      sprite: '/assets/items/armor/gold-ring.jpg',
      equipTo: 'ring',
      rarity: ItemRarity.UNCOMMON,
      requiredLevel: 4,
    },
    [
      { statType: StatType.CRITICAL_CHANCE, value: 5 },
      { statType: StatType.GOLD_FIND, value: 10 },
      { statType: StatType.LUCK, value: 5 },
    ]
  );

  await createItemWithStats(
    {
      name: 'Diamond Ring',
      price: 500,
      sprite: '/assets/items/armor/diamond-ring.jpg',
      equipTo: 'ring',
      rarity: ItemRarity.EPIC,
      requiredLevel: 10,
    },
    [
      { statType: StatType.CRITICAL_CHANCE, value: 8 },
      { statType: StatType.CRITICAL_DAMAGE, value: 15 },
      { statType: StatType.MAGIC_RESIST, value: 10 },
      { statType: StatType.GOLD_FIND, value: 20 },
    ]
  );

  // ============================================
  // JEWELRY - NECKLACES
  // ============================================

  await createItemWithStats(
    {
      name: 'Gold Necklace',
      price: 220,
      sprite: '/assets/items/armor/gold-necklace.jpg',
      equipTo: 'necklace',
      rarity: ItemRarity.UNCOMMON,
      requiredLevel: 5,
    },
    [
      { statType: StatType.HEALTH, value: 50 },
      { statType: StatType.MANA, value: 30 },
      { statType: StatType.MAGIC_RESIST, value: 8 },
      { statType: StatType.EXPERIENCE_GAIN, value: 5 },
    ]
  );

  // ============================================
  // JEWELRY - AMULETS
  // ============================================

  await createItemWithStats(
    {
      name: 'Gold Amulet',
      price: 280,
      sprite: '/assets/items/armor/gold-amulet.jpg',
      equipTo: 'amulet',
      rarity: ItemRarity.RARE,
      requiredLevel: 6,
    },
    [
      { statType: StatType.MAGIC_DAMAGE_MIN, value: 5 },
      { statType: StatType.MAGIC_DAMAGE_MAX, value: 10 },
      { statType: StatType.MANA, value: 80 },
      { statType: StatType.MANA_REGEN, value: 3 },
      { statType: StatType.MAGIC_RESIST, value: 12 },
    ]
  );

  // ============================================
  // STORAGE - BACKPACKS
  // ============================================

  await createItemWithStats(
    {
      name: 'XL Backpack',
      price: 120,
      sprite: '/assets/items/storage/backpacks/backpack-xl.jpg',
      equipTo: 'backpack',
      rarity: ItemRarity.COMMON,
      requiredLevel: 1,
    },
    [
      { statType: StatType.MOVEMENT_SPEED, value: -5 }, // Negative because it's heavy
    ]
  );

  // ============================================
  // CONSUMABLES - POTIONS
  // ============================================

  await createItemWithStats(
    {
      name: 'Health Potion',
      price: 25,
      sprite: '/assets/items/consumables/potions/health-potion.jpg',
      equipTo: null, // Consumable, not equipped
      rarity: ItemRarity.COMMON,
      requiredLevel: 1,
    },
    [
      { statType: StatType.HEALTH, value: 50 }, // Restores 50 HP
    ]
  );

  console.log('\n✅ Seed completed successfully!');
  console.log('📊 Total items created: Check your database');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
