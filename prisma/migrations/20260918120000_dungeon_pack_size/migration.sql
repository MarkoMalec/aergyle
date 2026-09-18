-- Dungeon pack size: how many monsters fight the character at once. Runs
-- snapshot it at entry; runs started before this migration fight one at a time.

-- AlterTable
ALTER TABLE `Dungeon` ADD COLUMN `packSize` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `UserDungeonRun` ADD COLUMN `packSize` INTEGER NOT NULL DEFAULT 1;

