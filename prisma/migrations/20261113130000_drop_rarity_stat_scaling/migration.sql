-- Rarity no longer changes stats. Apply only after scripts/bakeRarityIntoStats.ts
-- has baked every item's rarity stats into its base stats (backup:
-- prisma/rebalance/backup-before-enchant-scaling.json).

-- DropForeignKey
ALTER TABLE `ItemStatProgression` DROP FOREIGN KEY `ItemStatProgression_itemId_fkey`;

-- DropForeignKey
ALTER TABLE `ItemStatRarityOverride` DROP FOREIGN KEY `ItemStatRarityOverride_itemId_fkey`;

-- AlterTable
ALTER TABLE `Item` DROP COLUMN `flipNegativeStatsWithRarity`;

-- AlterTable
ALTER TABLE `RarityConfig` DROP COLUMN `statMultiplier`;

-- DropTable
DROP TABLE `ItemStatProgression`;

-- DropTable
DROP TABLE `ItemStatRarityOverride`;


-- A player item's rarity always comes from its Item; crafting no longer picks one.
-- AlterTable
ALTER TABLE `VocationalResource` DROP COLUMN `rarity`;
