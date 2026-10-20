-- CreateTable
CREATE TABLE `UserGatheringExpeditionLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `locationId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `claimedAt` DATETIME(3) NOT NULL,
    `durationSeconds` INTEGER NOT NULL,
    `xpReward` INTEGER NOT NULL,
    `rewards` JSON NOT NULL,

    INDEX `UserGatheringExpeditionLog_userId_claimedAt_idx`(`userId`, `claimedAt`),
    INDEX `UserGatheringExpeditionLog_locationId_idx`(`locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserGatheringExpeditionLog` ADD CONSTRAINT `UserGatheringExpeditionLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserGatheringExpeditionLog` ADD CONSTRAINT `UserGatheringExpeditionLog_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: each character's last claimed expedition opens their journal.
INSERT INTO `UserGatheringExpeditionLog` (`userId`, `locationId`, `startedAt`, `claimedAt`, `durationSeconds`, `xpReward`, `rewards`)
SELECT `userId`, `locationId`, `startedAt`, `claimedAt`, `durationSeconds`, `xpReward`, `rewards`
FROM `UserGatheringExpedition`
WHERE `claimedAt` IS NOT NULL AND `rewards` IS NOT NULL;
