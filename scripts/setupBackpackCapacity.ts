import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType } from "@prisma/client";
import { setItemStatProgressions } from "~/utils/statProgressions";

/**
 * Set up CARRYING_CAPACITY stat progressions for backpacks
 * Example: XL Backpack (id: 35)
 */

async function setupBackpackCarryingCapacity() {
  console.log("🎒 Setting up CARRYING_CAPACITY for backpacks...\n");

  // XL Backpack (id: 35) - Example stat progression
  // COMMON: +5 slots
  // RARE: +10 slots  
  // EPIC: +15 slots
  // LEGENDARY: +20 slots
  // MYTHIC: +25 slots
  // DIVINE: +30 slots

  await setItemStatProgressions(35, [
    {
      statType: StatType.CARRYING_CAPACITY,
      baseValue: 5, // COMMON gives 5 extra slots
      unlocksAtRarity: ItemRarity.COMMON,
    },
  ]);

  console.log("✅ XL Backpack configured:");
  console.log("   - COMMON: +5 slots (25 base + 5 = 30 total)");
  console.log("   - UNCOMMON: +5.75 slots (rounded to +5)");
  console.log("   - RARE: +6.75 slots (rounded to +6)");
  console.log("   - EPIC: +8.5 slots (rounded to +8)");
  console.log("   - LEGENDARY: +11.5 slots (rounded to +11)");
  console.log("   - MYTHIC: +13.5 slots (rounded to +13)");
  console.log("   - DIVINE: +15 slots (25 base + 15 = 40 total)");

  console.log("\n💡 Tip: Create more backpack tiers with different base values:");
  console.log("   Small Backpack: baseValue: 3 (+3 slots at COMMON)");
  console.log("   Medium Backpack: baseValue: 5 (+5 slots at COMMON)");
  console.log("   Large Backpack: baseValue: 7 (+7 slots at COMMON)");
  console.log("   XL Backpack: baseValue: 10 (+10 slots at COMMON)");

  console.log("\n📝 How to test:");
  console.log("   1. Create a COMMON XL Backpack for a player");
  console.log("   2. Equip it (triggers capacity update)");
  console.log("   3. Check inventory - should have 30 slots (25 base + 5)");
  console.log("   4. Upgrade backpack to DIVINE");
  console.log("   5. Re-equip - should have 40 slots (25 base + 15)");
}

// Run if executed directly
// if (require.main === module) {
  setupBackpackCarryingCapacity()
    .then(() => {
      console.log("\n✅ Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
// }

export { setupBackpackCarryingCapacity };
