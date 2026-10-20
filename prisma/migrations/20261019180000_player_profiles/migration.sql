-- Public player profiles: account age, bio, profile comments, daily activity.

-- AlterTable
ALTER TABLE `User` ADD COLUMN `bio` VARCHAR(300) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- `last_online` was set once at sign-up and never written since, so it is
-- each account's creation time. From here on it tracks presence instead.
-- TIMESTAMP reads in the session's zone; DATETIME columns hold UTC.
SET time_zone = '+00:00';
UPDATE `User` SET `createdAt` = `last_online`;

-- AlterTable
ALTER TABLE `MessageReport` ADD COLUMN `profileCommentId` INTEGER NULL,
    ADD COLUMN `source` ENUM('MESSAGE', 'PROFILE_COMMENT') NOT NULL DEFAULT 'MESSAGE';

-- CreateTable
CREATE TABLE `ProfileComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `parentId` INTEGER NULL,
    `body` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProfileComment_profileId_parentId_id_idx`(`profileId`, `parentId`, `id`),
    INDEX `ProfileComment_authorId_idx`(`authorId`),
    INDEX `ProfileComment_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayerDailyActivity` (
    `userId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `xp` BIGINT NOT NULL DEFAULT 0,
    `seconds` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`userId`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `MessageReport_profileCommentId_idx` ON `MessageReport`(`profileCommentId`);

-- AddForeignKey
ALTER TABLE `MessageReport` ADD CONSTRAINT `MessageReport_profileCommentId_fkey` FOREIGN KEY (`profileCommentId`) REFERENCES `ProfileComment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileComment` ADD CONSTRAINT `ProfileComment_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileComment` ADD CONSTRAINT `ProfileComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfileComment` ADD CONSTRAINT `ProfileComment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProfileComment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerDailyActivity` ADD CONSTRAINT `PlayerDailyActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

