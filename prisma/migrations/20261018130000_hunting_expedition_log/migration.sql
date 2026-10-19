-- CreateTable
CREATE TABLE `UserHuntingExpeditionLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `groundId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `claimedAt` DATETIME(3) NOT NULL,
    `durationSeconds` INTEGER NOT NULL,
    `xpReward` INTEGER NOT NULL,
    `rewards` JSON NOT NULL,
    `report` JSON NOT NULL,

    INDEX `UserHuntingExpeditionLog_userId_claimedAt_idx`(`userId`, `claimedAt`),
    INDEX `UserHuntingExpeditionLog_groundId_idx`(`groundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserHuntingExpeditionLog` ADD CONSTRAINT `UserHuntingExpeditionLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserHuntingExpeditionLog` ADD CONSTRAINT `UserHuntingExpeditionLog_groundId_fkey` FOREIGN KEY (`groundId`) REFERENCES `HuntingGround`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: each character's last claimed hunt opens their journal.
INSERT INTO `UserHuntingExpeditionLog` (`userId`, `groundId`, `startedAt`, `claimedAt`, `durationSeconds`, `xpReward`, `rewards`, `report`)
SELECT `userId`, `groundId`, `startedAt`, `claimedAt`, `durationSeconds`, `xpReward`, COALESCE(`rewards`, JSON_ARRAY()), `report`
FROM `UserHuntingExpedition`
WHERE `claimedAt` IS NOT NULL AND `report` IS NOT NULL;
