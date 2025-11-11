import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType } from "@prisma/client";
import { setItemStatProgressions } from "~/utils/statProgressions";

/**
 * Example: Set up stat progressions for existing items
 * 
 * Run this script to configure which stats unlock at which rarity
 */

async function setupStatProgressions() {
  console.log("🔧 Setting up stat progressions for items...\n");

  // Example 1: Wooden Sword (id: 19)
  // - COMMON: Gets critical chance
  // - MYTHIC: Unlocks attack speed
  // - DIVINE: Unlocks lifesteal
  await setItemStatProgressions(19, [
    {
      statType: StatType.CRITICAL_CHANCE,
      baseValue: 5,
      unlocksAtRarity: ItemRarity.COMMON,
    },
    {
      statType: StatType.ATTACK_SPEED,
      baseValue: 0.1,
      unlocksAtRarity: ItemRarity.MYTHIC,
    },
    {
      statType: StatType.LIFESTEAL,
      baseValue: 3,
      unlocksAtRarity: ItemRarity.DIVINE,
    },
  ]);
  console.log("✅ Wooden Sword progressions set");

  // Example 2: Gold Helmet (id: 25)
  // - COMMON: Gets armor (already in item stats)
  // - RARE: Unlocks health
  // - LEGENDARY: Unlocks health regen
  await setItemStatProgressions(25, [
    {
      statType: StatType.ARMOR,
      baseValue: 15,
      unlocksAtRarity: ItemRarity.COMMON,
    },
    {
      statType: StatType.HEALTH,
      baseValue: 50,
      unlocksAtRarity: ItemRarity.RARE,
    },
    {
      statType: StatType.HEALTH_REGEN,
      baseValue: 2,
      unlocksAtRarity: ItemRarity.LEGENDARY,
    },
  ]);
  console.log("✅ Gold Helmet progressions set");

  // Example 3: Silver Revolver (id: 23)
  // - COMMON: Physical damage
  // - EPIC: Unlocks critical damage
  // - MYTHIC: Unlocks accuracy
  await setItemStatProgressions(23, [
    {
      statType: StatType.PHYSICAL_DAMAGE_MIN,
      baseValue: 15,
      unlocksAtRarity: ItemRarity.COMMON,
    },
    {
      statType: StatType.PHYSICAL_DAMAGE_MAX,
      baseValue: 25,
      unlocksAtRarity: ItemRarity.COMMON,
    },
    {
      statType: StatType.CRITICAL_DAMAGE,
      baseValue: 25,
      unlocksAtRarity: ItemRarity.EPIC,
    },
    {
      statType: StatType.ACCURACY,
      baseValue: 10,
      unlocksAtRarity: ItemRarity.MYTHIC,
    },
  ]);
  console.log("✅ Silver Revolver progressions set");

  console.log("\n✨ All stat progressions configured!");
  console.log("\n📝 How it works:");
  console.log("- COMMON Silver Revolver: 2 stats (min/max physical damage)");
  console.log("- EPIC Silver Revolver: 3 stats (adds critical damage)");
  console.log("- MYTHIC Silver Revolver: 4 stats (adds accuracy)");
  console.log("\n- COMMON Wooden Sword: 1 stat (critical chance)");
  console.log("- MYTHIC Wooden Sword: 2 stats (adds attack speed)");
  console.log("- DIVINE Wooden Sword: 3 stats (adds lifesteal)");
}

// Run if executed directly
if (require.main === module) {
  setupStatProgressions()
    .then(() => {
      console.log("\n✅ Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}

export { setupStatProgressions };
