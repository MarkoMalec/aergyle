-- NPC professions become rows admins manage instead of a fixed enum. Existing
-- blacksmiths keep their profession. Additive: the old `Npc.profession`
-- column stays (unused) until the deployed game no longer reads it.

-- CreateTable
CREATE TABLE `NpcProfession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NpcProfession_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Npc` ADD COLUMN `professionId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Npc_professionId_idx` ON `Npc`(`professionId`);

-- AddForeignKey
ALTER TABLE `Npc` ADD CONSTRAINT `Npc_professionId_fkey` FOREIGN KEY (`professionId`) REFERENCES `NpcProfession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry over the one profession the enum had.
INSERT INTO `NpcProfession` (`name`, `updatedAt`) VALUES ('Blacksmith', CURRENT_TIMESTAMP(3));
UPDATE `Npc`
SET `professionId` = (SELECT `id` FROM `NpcProfession` WHERE `name` = 'Blacksmith')
WHERE `profession` = 'BLACKSMITH';
