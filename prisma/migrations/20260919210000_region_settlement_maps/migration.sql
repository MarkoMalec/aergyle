-- Region and settlement maps: artwork for locations and settlements, pins for
-- the places on them, and the head crop NPCs show on the settlement map.

-- AlterTable
ALTER TABLE `Location` ADD COLUMN `mapImage` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `HuntingGround` ADD COLUMN `mapX` DOUBLE NULL,
    ADD COLUMN `mapY` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Dungeon` ADD COLUMN `mapX` DOUBLE NULL,
    ADD COLUMN `mapY` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Settlement` ADD COLUMN `mapImage` VARCHAR(191) NULL,
    ADD COLUMN `mapX` DOUBLE NULL,
    ADD COLUMN `mapY` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Npc` ADD COLUMN `headX` DOUBLE NULL,
    ADD COLUMN `headY` DOUBLE NULL,
    ADD COLUMN `headSize` DOUBLE NULL,
    ADD COLUMN `mapX` DOUBLE NULL,
    ADD COLUMN `mapY` DOUBLE NULL;
