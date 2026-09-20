-- Lifetime per-skill counters behind the metrics panel on a skill page.
-- Experience is not stored here; it is read from UserTrackProgress.

-- CreateTable
CREATE TABLE `UserSkillMetric` (
    `userId` VARCHAR(191) NOT NULL,
    `actionType` ENUM('WOODCUTTING', 'MINING', 'FISHING', 'GARDENING', 'GATHERING', 'HUNTING', 'ALCHEMY', 'BLACKSMITHING', 'WEAPONSMITHING', 'CARPENTRY', 'COOKING', 'TAILORING', 'FORGE') NOT NULL,
    `itemsGathered` BIGINT NOT NULL DEFAULT 0,
    `secondsSpent` BIGINT NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`, `actionType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserSkillMetric` ADD CONSTRAINT `UserSkillMetric_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
