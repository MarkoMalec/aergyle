-- AlterTable
ALTER TABLE `User` ADD COLUMN `experience` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `level` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `XpConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `baseXp` DOUBLE NOT NULL DEFAULT 100,
    `exponentMultiplier` DOUBLE NOT NULL DEFAULT 1.5,
    `levelMultiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `easyLevelCap` INTEGER NOT NULL DEFAULT 5,
    `easyMultiplier` DOUBLE NOT NULL DEFAULT 0.8,
    `normalLevelCap` INTEGER NOT NULL DEFAULT 15,
    `normalMultiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `hardLevelCap` INTEGER NOT NULL DEFAULT 30,
    `hardMultiplier` DOUBLE NOT NULL DEFAULT 1.3,
    `veryHardLevelCap` INTEGER NOT NULL DEFAULT 50,
    `veryHardMultiplier` DOUBLE NOT NULL DEFAULT 1.8,
    `extremeLevelCap` INTEGER NOT NULL DEFAULT 62,
    `extremeMultiplier` DOUBLE NOT NULL DEFAULT 3.0,
    `softCapLevel` INTEGER NOT NULL DEFAULT 62,
    `softCapMultiplier` DOUBLE NOT NULL DEFAULT 10.0,
    `hardCapLevel` INTEGER NOT NULL DEFAULT 70,
    `seasonalBonus` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `XpConfig_configName_key`(`configName`),
    INDEX `XpConfig_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `XpMultiplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `multiplier` DOUBLE NOT NULL,
    `actionType` ENUM('COMBAT', 'QUEST', 'CRAFTING', 'GATHERING', 'SKILL', 'EXPLORATION', 'DUNGEON', 'BOSS', 'PVP', 'TRADE', 'ACHIEVEMENT', 'DAILY', 'EVENT') NULL,
    `expiresAt` DATETIME(3) NULL,
    `usesRemaining` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `stackable` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `XpMultiplier_userId_isActive_expiresAt_idx`(`userId`, `isActive`, `expiresAt`),
    INDEX `XpMultiplier_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `XpTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `finalAmount` DOUBLE NOT NULL,
    `actionType` ENUM('COMBAT', 'QUEST', 'CRAFTING', 'GATHERING', 'SKILL', 'EXPLORATION', 'DUNGEON', 'BOSS', 'PVP', 'TRADE', 'ACHIEVEMENT', 'DAILY', 'EVENT') NOT NULL,
    `baseMultiplier` DOUBLE NOT NULL DEFAULT 1.0,
    `itemMultipliers` JSON NULL,
    `eventMultipliers` JSON NULL,
    `levelBefore` INTEGER NOT NULL,
    `levelAfter` INTEGER NOT NULL,
    `experienceBefore` DOUBLE NOT NULL,
    `experienceAfter` DOUBLE NOT NULL,
    `description` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `XpTransaction_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `XpTransaction_actionType_idx`(`actionType`),
    INDEX `XpTransaction_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_level_idx` ON `User`(`level`);

-- CreateIndex
CREATE INDEX `User_experience_idx` ON `User`(`experience`);

-- AddForeignKey
ALTER TABLE `XpMultiplier` ADD CONSTRAINT `XpMultiplier_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
