import { initializeRarityConfigs } from "~/utils/rarity";

/**
 * Initialize all rarity configurations in the database
 * This adds all 12 rarity tiers to the RarityConfig table
 */

async function main() {
  console.log("🔧 Initializing rarity configurations...\n");

  await initializeRarityConfigs();

  console.log("✅ All 12 rarities initialized:");
  console.log("   1. WORTHLESS (0.5x)");
  console.log("   2. BROKEN (0.75x)");
  console.log("   3. COMMON (1.0x)");
  console.log("   4. UNCOMMON (1.15x)");
  console.log("   5. RARE (1.35x)");
  console.log("   6. EXQUISITE (1.5x)");
  console.log("   7. EPIC (1.7x)");
  console.log("   8. ELITE (1.9x)");
  console.log("   9. UNIQUE (2.1x)");
  console.log("  10. LEGENDARY (2.3x)");
  console.log("  11. MYTHIC (2.7x)");
  console.log("  12. DIVINE (3.0x)");
}

main()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
