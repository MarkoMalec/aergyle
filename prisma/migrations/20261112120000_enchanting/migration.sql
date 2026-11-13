-- Enchanting (docs/ENCHANTING_SYSTEM.md). Additive: existing items start at enchant level 0
-- and the game uses code defaults until /admin/enchanting saves rows.


-- AlterTable
ALTER TABLE `UserItem` ADD COLUMN `enchantLevel` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `MarketTransaction` ADD COLUMN `enchantLevel` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `EnchantLevelConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('GEAR', 'ACCESSORY') NOT NULL,
    `level` INTEGER NOT NULL,
    `successChance` DOUBLE NOT NULL,
    `goldCost` INTEGER NOT NULL,
    `statBonusPercent` DOUBLE NOT NULL,
    `dropOnFail` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EnchantLevelConfig_kind_level_key`(`kind`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnchantLevelMaterial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `EnchantLevelMaterial_itemId_idx`(`itemId`),
    UNIQUE INDEX `EnchantLevelMaterial_configId_itemId_key`(`configId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemEnchantChanceOverride` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `level` INTEGER NOT NULL,
    `successChance` DOUBLE NOT NULL,

    UNIQUE INDEX `ItemEnchantChanceOverride_itemId_level_key`(`itemId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserEnchantPity` (
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('GEAR', 'ACCESSORY') NOT NULL,
    `level` INTEGER NOT NULL,
    `failures` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`userId`, `kind`, `level`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnchantConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `pityPerFailure` DOUBLE NOT NULL DEFAULT 0.0025,
    `pityCap` DOUBLE NOT NULL DEFAULT 0.025,
    `levelCostDivisor` INTEGER NOT NULL DEFAULT 50,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EnchantLevelMaterial` ADD CONSTRAINT `EnchantLevelMaterial_configId_fkey` FOREIGN KEY (`configId`) REFERENCES `EnchantLevelConfig`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnchantLevelMaterial` ADD CONSTRAINT `EnchantLevelMaterial_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ItemEnchantChanceOverride` ADD CONSTRAINT `ItemEnchantChanceOverride_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserEnchantPity` ADD CONSTRAINT `UserEnchantPity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

