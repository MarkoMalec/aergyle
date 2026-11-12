-- Community projects get stages, schedules, criteria, rewards and effects.
-- Every existing project becomes a one-time project with a single stage that
-- keeps its requirements, contributions, completion and unlocked content.

-- AlterTable
ALTER TABLE `CommunityProject` ADD COLUMN `endsAt` DATETIME(3) NULL,
    ADD COLUMN `maxRounds` INTEGER NULL,
    ADD COLUMN `maxSharePercent` INTEGER NULL,
    ADD COLUMN `minLevel` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `repeat` ENUM('ONCE', 'SCHEDULE', 'AFTER_COMPLETION') NOT NULL DEFAULT 'ONCE',
    ADD COLUMN `repeatHours` INTEGER NOT NULL DEFAULT 168,
    ADD COLUMN `requiredSkillId` INTEGER NULL,
    ADD COLUMN `requiredSkillLevel` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `rewardMinSharePercent` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `rewardSplit` ENUM('FLAT', 'BY_SHARE') NOT NULL DEFAULT 'FLAT',
    ADD COLUMN `round` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `roundStartedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `showFutureStages` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `startsAt` DATETIME(3) NULL,
    ADD COLUMN `unlockMode` ENUM('PERMANENT', 'WHILE_REACHED') NOT NULL DEFAULT 'PERMANENT';

-- CreateTable
CREATE TABLE `CommunityProjectStage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `image` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `rewardGold` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `rewardXp` INTEGER NOT NULL DEFAULT 0,

    INDEX `CommunityProjectStage_active_idx`(`active`),
    UNIQUE INDEX `CommunityProjectStage_projectId_position_key`(`projectId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityProjectRewardItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stageId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `CommunityProjectRewardItem_itemId_idx`(`itemId`),
    UNIQUE INDEX `CommunityProjectRewardItem_stageId_itemId_key`(`stageId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityProjectEffect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stageId` INTEGER NOT NULL,
    `type` ENUM('SHOP_DISCOUNT', 'SELL_BONUS', 'STORAGE_SLOTS', 'TRAVEL_SPEED', 'QUEST_REWARD_BONUS') NOT NULL,
    `value` DOUBLE NOT NULL,

    UNIQUE INDEX `CommunityProjectEffect_stageId_type_key`(`stageId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityProjectReward` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` INTEGER NOT NULL,
    `stageId` INTEGER NOT NULL,
    `round` INTEGER NOT NULL,
    `gold` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `xp` INTEGER NOT NULL DEFAULT 0,
    `items` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimedAt` DATETIME(3) NULL,

    INDEX `CommunityProjectReward_userId_claimedAt_idx`(`userId`, `claimedAt`),
    INDEX `CommunityProjectReward_projectId_idx`(`projectId`),
    INDEX `CommunityProjectReward_stageId_idx`(`stageId`),
    UNIQUE INDEX `CommunityProjectReward_userId_stageId_round_key`(`userId`, `stageId`, `round`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Data: one stage per existing project, reached if the project was completed.
INSERT INTO `CommunityProjectStage` (`projectId`, `position`, `name`, `completedAt`, `active`)
SELECT `id`, 1, `name`, `completedAt`, `completedAt` IS NOT NULL FROM `CommunityProject`;

-- Requirements move from the project to its stage.
ALTER TABLE `CommunityProjectRequirement` ADD COLUMN `stageId` INTEGER NULL;
UPDATE `CommunityProjectRequirement` r JOIN `CommunityProjectStage` s ON s.`projectId` = r.`projectId` SET r.`stageId` = s.`id`;
ALTER TABLE `CommunityProjectRequirement` DROP FOREIGN KEY `CommunityProjectRequirement_projectId_fkey`;
DROP INDEX `CommunityProjectRequirement_projectId_itemId_key` ON `CommunityProjectRequirement`;
ALTER TABLE `CommunityProjectRequirement` DROP COLUMN `projectId`, MODIFY `stageId` INTEGER NOT NULL;
CREATE UNIQUE INDEX `CommunityProjectRequirement_stageId_itemId_key` ON `CommunityProjectRequirement`(`stageId`, `itemId`);

-- Npc: hidden until a stage instead of a project.
ALTER TABLE `Npc` ADD COLUMN `requiredStageId` INTEGER NULL;
UPDATE `Npc` t JOIN `CommunityProjectStage` s ON s.`projectId` = t.`requiredProjectId` SET t.`requiredStageId` = s.`id`;
ALTER TABLE `Npc` DROP FOREIGN KEY `Npc_requiredProjectId_fkey`;
DROP INDEX `Npc_requiredProjectId_idx` ON `Npc`;
ALTER TABLE `Npc` DROP COLUMN `requiredProjectId`;
CREATE INDEX `Npc_requiredStageId_idx` ON `Npc`(`requiredStageId`);

-- NpcOffer: hidden until a stage instead of a project.
ALTER TABLE `NpcOffer` ADD COLUMN `requiredStageId` INTEGER NULL;
UPDATE `NpcOffer` t JOIN `CommunityProjectStage` s ON s.`projectId` = t.`requiredProjectId` SET t.`requiredStageId` = s.`id`;
ALTER TABLE `NpcOffer` DROP FOREIGN KEY `NpcOffer_requiredProjectId_fkey`;
DROP INDEX `NpcOffer_requiredProjectId_idx` ON `NpcOffer`;
ALTER TABLE `NpcOffer` DROP COLUMN `requiredProjectId`;
CREATE INDEX `NpcOffer_requiredStageId_idx` ON `NpcOffer`(`requiredStageId`);

-- Quest: hidden until a stage instead of a project.
ALTER TABLE `Quest` ADD COLUMN `requiredStageId` INTEGER NULL;
UPDATE `Quest` t JOIN `CommunityProjectStage` s ON s.`projectId` = t.`requiredProjectId` SET t.`requiredStageId` = s.`id`;
ALTER TABLE `Quest` DROP FOREIGN KEY `Quest_requiredProjectId_fkey`;
DROP INDEX `Quest_requiredProjectId_idx` ON `Quest`;
ALTER TABLE `Quest` DROP COLUMN `requiredProjectId`;
CREATE INDEX `Quest_requiredStageId_idx` ON `Quest`(`requiredStageId`);

-- Dungeons and hunting grounds can be hidden until a stage too.
ALTER TABLE `HuntingGround` ADD COLUMN `requiredStageId` INTEGER NULL;
ALTER TABLE `Dungeon` ADD COLUMN `requiredStageId` INTEGER NULL;
CREATE INDEX `HuntingGround_requiredStageId_idx` ON `HuntingGround`(`requiredStageId`);
CREATE INDEX `Dungeon_requiredStageId_idx` ON `Dungeon`(`requiredStageId`);
CREATE INDEX `CommunityProject_requiredSkillId_idx` ON `CommunityProject`(`requiredSkillId`);

-- AddForeignKey
ALTER TABLE `HuntingGround` ADD CONSTRAINT `HuntingGround_requiredStageId_fkey` FOREIGN KEY (`requiredStageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dungeon` ADD CONSTRAINT `Dungeon_requiredStageId_fkey` FOREIGN KEY (`requiredStageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Npc` ADD CONSTRAINT `Npc_requiredStageId_fkey` FOREIGN KEY (`requiredStageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NpcOffer` ADD CONSTRAINT `NpcOffer_requiredStageId_fkey` FOREIGN KEY (`requiredStageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quest` ADD CONSTRAINT `Quest_requiredStageId_fkey` FOREIGN KEY (`requiredStageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProject` ADD CONSTRAINT `CommunityProject_requiredSkillId_fkey` FOREIGN KEY (`requiredSkillId`) REFERENCES `skills`(`skill_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectStage` ADD CONSTRAINT `CommunityProjectStage_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `CommunityProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectRequirement` ADD CONSTRAINT `CommunityProjectRequirement_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectRewardItem` ADD CONSTRAINT `CommunityProjectRewardItem_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectRewardItem` ADD CONSTRAINT `CommunityProjectRewardItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectEffect` ADD CONSTRAINT `CommunityProjectEffect_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectReward` ADD CONSTRAINT `CommunityProjectReward_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectReward` ADD CONSTRAINT `CommunityProjectReward_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `CommunityProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectReward` ADD CONSTRAINT `CommunityProjectReward_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `CommunityProjectStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
