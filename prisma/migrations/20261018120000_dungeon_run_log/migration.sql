-- CreateTable
CREATE TABLE `UserDungeonRunLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `dungeonId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `claimedAt` DATETIME(3) NOT NULL,
    `durationSeconds` INTEGER NOT NULL,
    `rewards` JSON NOT NULL,
    `report` JSON NOT NULL,

    INDEX `UserDungeonRunLog_userId_claimedAt_idx`(`userId`, `claimedAt`),
    INDEX `UserDungeonRunLog_dungeonId_idx`(`dungeonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserDungeonRunLog` ADD CONSTRAINT `UserDungeonRunLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDungeonRunLog` ADD CONSTRAINT `UserDungeonRunLog_dungeonId_fkey` FOREIGN KEY (`dungeonId`) REFERENCES `Dungeon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: each character's last claimed run opens their journal.
INSERT INTO `UserDungeonRunLog` (`userId`, `dungeonId`, `startedAt`, `claimedAt`, `durationSeconds`, `rewards`, `report`)
SELECT `userId`, `dungeonId`, `startedAt`, `claimedAt`, `durationSeconds`, COALESCE(`rewards`, JSON_ARRAY()), `report`
FROM `UserDungeonRun`
WHERE `claimedAt` IS NOT NULL AND `report` IS NOT NULL;
