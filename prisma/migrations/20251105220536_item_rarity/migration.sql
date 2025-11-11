-- AlterTable
ALTER TABLE `Item` MODIFY `rarity` ENUM('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'MYTHIC') NOT NULL DEFAULT 'COMMON';

-- CreateTable
CREATE TABLE `RarityConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rarity` ENUM('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'MYTHIC') NOT NULL,
    `statMultiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `minStats` INTEGER NOT NULL DEFAULT 1,
    `maxStats` INTEGER NOT NULL DEFAULT 3,
    `bonusStatChance` DOUBLE NOT NULL DEFAULT 0,
    `color` VARCHAR(191) NOT NULL DEFAULT '#ffffff',
    `displayName` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `upgradeEnabled` BOOLEAN NOT NULL DEFAULT true,
    `nextRarity` ENUM('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'MYTHIC') NULL,
    `upgradeCost` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RarityConfig_rarity_key`(`rarity`),
    INDEX `RarityConfig_rarity_idx`(`rarity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
