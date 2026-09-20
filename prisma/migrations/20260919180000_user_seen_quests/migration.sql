-- One-time quests a player has had on screen. Available ones without a row
-- light up the new-quest dots on the Settlements menu and cards.

-- CreateTable
CREATE TABLE `UserSeenQuest` (
    `userId` VARCHAR(191) NOT NULL,
    `questId` INTEGER NOT NULL,
    `seenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserSeenQuest_questId_idx`(`questId`),
    PRIMARY KEY (`userId`, `questId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserSeenQuest` ADD CONSTRAINT `UserSeenQuest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSeenQuest` ADD CONSTRAINT `UserSeenQuest_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
