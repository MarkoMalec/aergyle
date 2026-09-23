-- The world atlas becomes admin-managed: its artwork lives in AtlasConfig and
-- each location carries its own pin, instead of both being hardcoded in
-- src/game/world/atlasLocations.ts. The seeded values below are the ones that
-- file held, so the atlas looks the same until an admin moves something.

-- AlterTable
ALTER TABLE `Location` ADD COLUMN `mapX` DOUBLE NULL,
    ADD COLUMN `mapY` DOUBLE NULL;

-- CreateTable
CREATE TABLE `AtlasConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `mapImage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AtlasConfig` (`id`, `mapImage`, `updatedAt`)
VALUES (1, '/assets/world/world-map-v1.png', CURRENT_TIMESTAMP(3));

UPDATE `Location` SET `mapX` = 64, `mapY` = 76 WHERE `name` = 'Crownhold';
UPDATE `Location` SET `mapX` = 23, `mapY` = 56 WHERE `name` = 'Greenveil Plains';
UPDATE `Location` SET `mapX` = 42.5, `mapY` = 50 WHERE `name` = 'Citadel';
UPDATE `Location` SET `mapX` = 60.5, `mapY` = 29 WHERE `name` = 'Goblins Camp';
UPDATE `Location` SET `mapX` = 14, `mapY` = 17 WHERE `name` = 'Frostcrown Peaks';
UPDATE `Location` SET `mapX` = 48, `mapY` = 31 WHERE `name` = 'Ruins of Caldrath';
UPDATE `Location` SET `mapX` = 40.5, `mapY` = 14 WHERE `name` = 'Mount Doom';
UPDATE `Location` SET `mapX` = 8, `mapY` = 86 WHERE `name` = 'Pirate Island';
