-- Dungeons: timed, lethal PvE runs resolved at claim. Creatures gain a combat
-- profile (defaults 0, so Hunting animals are unchanged) and dungeons reuse
-- the shared Creature/CreatureDrop catalogue for monsters and loot.

-- AlterTable
ALTER TABLE `Creature` ADD COLUMN `armor` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `blockChance` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `critChance` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `critDamage` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `damageType` ENUM('FIRE', 'ICE', 'LIGHTNING', 'POISON') NULL,
    ADD COLUMN `elementalDamageMax` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `elementalDamageMin` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `evasion` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `health` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `magicResist` DOUBLE NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Dungeon` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locationId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `difficulty` ENUM('EASY', 'NORMAL', 'HARD', 'DEADLY') NOT NULL DEFAULT 'NORMAL',
    `requiredLevel` INTEGER NOT NULL DEFAULT 1,
    `durationSeconds` INTEGER NOT NULL DEFAULT 1800,
    `xpReward` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Dungeon_locationId_enabled_sortOrder_idx`(`locationId`, `enabled`, `sortOrder`),
    UNIQUE INDEX `Dungeon_locationId_name_key`(`locationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DungeonMonster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dungeonId` INTEGER NOT NULL,
    `creatureId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `minCount` INTEGER NOT NULL DEFAULT 1,
    `maxCount` INTEGER NOT NULL DEFAULT 1,

    INDEX `DungeonMonster_dungeonId_enabled_idx`(`dungeonId`, `enabled`),
    INDEX `DungeonMonster_creatureId_idx`(`creatureId`),
    UNIQUE INDEX `DungeonMonster_dungeonId_creatureId_key`(`dungeonId`, `creatureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DungeonConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `minimumHealthToStartPercent` DOUBLE NOT NULL DEFAULT 25,
    `deathLootKeepChance` DOUBLE NOT NULL DEFAULT 0.35,
    `deathLootQuantityPercent` DOUBLE NOT NULL DEFAULT 25,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserDungeonRun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `dungeonId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NOT NULL,
    `claimedAt` DATETIME(3) NULL,
    `durationSeconds` INTEGER NOT NULL,
    `xpReward` INTEGER NOT NULL,
    `startingHealth` DOUBLE NOT NULL,
    `combatSnapshot` JSON NOT NULL,
    `monsterPool` JSON NOT NULL,
    `deathRules` JSON NOT NULL,
    `resolutionSeed` VARCHAR(191) NOT NULL,
    `rewards` JSON NULL,
    `report` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserDungeonRun_userId_key`(`userId`),
    INDEX `UserDungeonRun_endsAt_idx`(`endsAt`),
    INDEX `UserDungeonRun_dungeonId_idx`(`dungeonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Dungeon` ADD CONSTRAINT `Dungeon_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DungeonMonster` ADD CONSTRAINT `DungeonMonster_dungeonId_fkey` FOREIGN KEY (`dungeonId`) REFERENCES `Dungeon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DungeonMonster` ADD CONSTRAINT `DungeonMonster_creatureId_fkey` FOREIGN KEY (`creatureId`) REFERENCES `Creature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDungeonRun` ADD CONSTRAINT `UserDungeonRun_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDungeonRun` ADD CONSTRAINT `UserDungeonRun_dungeonId_fkey` FOREIGN KEY (`dungeonId`) REFERENCES `Dungeon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO `DungeonConfig`
  (`id`, `minimumHealthToStartPercent`, `deathLootKeepChance`, `deathLootQuantityPercent`, `createdAt`, `updatedAt`)
VALUES (1, 25, 0.35, 25, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);
