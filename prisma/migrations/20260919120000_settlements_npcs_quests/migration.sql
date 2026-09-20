-- Settlements: a location's common ground with NPCs (shops and quests) and
-- community projects whose completion unlocks NPCs, offers and quests.

-- CreateTable
CREATE TABLE `Settlement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locationId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('VILLAGE', 'TOWN', 'CITY') NOT NULL DEFAULT 'VILLAGE',
    `description` TEXT NULL,
    `image` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Settlement_locationId_enabled_sortOrder_idx`(`locationId`, `enabled`, `sortOrder`),
    UNIQUE INDEX `Settlement_locationId_name_key`(`locationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Npc` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `settlementId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `portrait` VARCHAR(191) NULL,
    `profession` ENUM('BLACKSMITH') NULL,
    `requiredProjectId` INTEGER NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Npc_settlementId_enabled_sortOrder_idx`(`settlementId`, `enabled`, `sortOrder`),
    INDEX `Npc_requiredProjectId_idx`(`requiredProjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NpcOffer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `npcId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `availableFrom` DATETIME(3) NULL,
    `availableUntil` DATETIME(3) NULL,
    `requiredProjectId` INTEGER NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `NpcOffer_npcId_enabled_sortOrder_idx`(`npcId`, `enabled`, `sortOrder`),
    INDEX `NpcOffer_itemId_idx`(`itemId`),
    INDEX `NpcOffer_requiredProjectId_idx`(`requiredProjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `npcId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `repeat` ENUM('ONCE', 'DAILY', 'WEEKLY') NOT NULL DEFAULT 'ONCE',
    `requiredLevel` INTEGER NOT NULL DEFAULT 1,
    `rewardGold` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `rewardXp` INTEGER NOT NULL DEFAULT 0,
    `requiredProjectId` INTEGER NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Quest_npcId_enabled_sortOrder_idx`(`npcId`, `enabled`, `sortOrder`),
    INDEX `Quest_requiredProjectId_idx`(`requiredProjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestObjective` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questId` INTEGER NOT NULL,
    `type` ENUM('DELIVER', 'HUNT', 'CLEAR') NOT NULL,
    `itemId` INTEGER NULL,
    `creatureId` INTEGER NULL,
    `dungeonId` INTEGER NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `QuestObjective_questId_idx`(`questId`),
    INDEX `QuestObjective_itemId_idx`(`itemId`),
    INDEX `QuestObjective_creatureId_idx`(`creatureId`),
    INDEX `QuestObjective_dungeonId_idx`(`dungeonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestRewardItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `QuestRewardItem_itemId_idx`(`itemId`),
    UNIQUE INDEX `QuestRewardItem_questId_itemId_key`(`questId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserQuest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `questId` INTEGER NOT NULL,
    `period` VARCHAR(16) NOT NULL,
    `progress` JSON NULL,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `UserQuest_questId_idx`(`questId`),
    INDEX `UserQuest_userId_completedAt_idx`(`userId`, `completedAt`),
    UNIQUE INDEX `UserQuest_userId_questId_period_key`(`userId`, `questId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityProject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `settlementId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `image` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunityProject_settlementId_enabled_sortOrder_idx`(`settlementId`, `enabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityProjectRequirement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `contributed` INTEGER NOT NULL DEFAULT 0,

    INDEX `CommunityProjectRequirement_itemId_idx`(`itemId`),
    UNIQUE INDEX `CommunityProjectRequirement_projectId_itemId_key`(`projectId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunityProjectContribution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requirementId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunityProjectContribution_userId_idx`(`userId`),
    UNIQUE INDEX `CommunityProjectContribution_requirementId_userId_key`(`requirementId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Npc` ADD CONSTRAINT `Npc_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Npc` ADD CONSTRAINT `Npc_requiredProjectId_fkey` FOREIGN KEY (`requiredProjectId`) REFERENCES `CommunityProject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NpcOffer` ADD CONSTRAINT `NpcOffer_npcId_fkey` FOREIGN KEY (`npcId`) REFERENCES `Npc`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NpcOffer` ADD CONSTRAINT `NpcOffer_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NpcOffer` ADD CONSTRAINT `NpcOffer_requiredProjectId_fkey` FOREIGN KEY (`requiredProjectId`) REFERENCES `CommunityProject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quest` ADD CONSTRAINT `Quest_npcId_fkey` FOREIGN KEY (`npcId`) REFERENCES `Npc`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quest` ADD CONSTRAINT `Quest_requiredProjectId_fkey` FOREIGN KEY (`requiredProjectId`) REFERENCES `CommunityProject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestObjective` ADD CONSTRAINT `QuestObjective_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestObjective` ADD CONSTRAINT `QuestObjective_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestObjective` ADD CONSTRAINT `QuestObjective_creatureId_fkey` FOREIGN KEY (`creatureId`) REFERENCES `Creature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestObjective` ADD CONSTRAINT `QuestObjective_dungeonId_fkey` FOREIGN KEY (`dungeonId`) REFERENCES `Dungeon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestRewardItem` ADD CONSTRAINT `QuestRewardItem_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestRewardItem` ADD CONSTRAINT `QuestRewardItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserQuest` ADD CONSTRAINT `UserQuest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserQuest` ADD CONSTRAINT `UserQuest_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `Quest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProject` ADD CONSTRAINT `CommunityProject_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectRequirement` ADD CONSTRAINT `CommunityProjectRequirement_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `CommunityProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectRequirement` ADD CONSTRAINT `CommunityProjectRequirement_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectContribution` ADD CONSTRAINT `CommunityProjectContribution_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `CommunityProjectRequirement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunityProjectContribution` ADD CONSTRAINT `CommunityProjectContribution_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

