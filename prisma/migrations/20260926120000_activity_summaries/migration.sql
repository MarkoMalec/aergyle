-- AlterTable
ALTER TABLE `User` ADD COLUMN `summariesSeenAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `UserGardenHarvestActivity` ADD COLUMN `totals` JSON NULL;

-- AlterTable
ALTER TABLE `UserVocationalActivity` ADD COLUMN `totals` JSON NULL;

-- CreateTable
CREATE TABLE `ActivitySummary` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `endedAt` DATETIME(3) NOT NULL,
    `data` JSON NOT NULL,

    INDEX `ActivitySummary_userId_endedAt_idx`(`userId`, `endedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivitySummary` ADD CONSTRAINT `ActivitySummary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

