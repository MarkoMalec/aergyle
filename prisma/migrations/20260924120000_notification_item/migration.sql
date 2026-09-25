-- Notifications can carry an item, drawn as its artwork beside the note (a
-- sale shows what sold). Deleting the item only drops the picture.

-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `itemId` INTEGER NULL,
    ADD COLUMN `itemRarity` ENUM('WORTHLESS', 'BROKEN', 'COMMON', 'UNCOMMON', 'RARE', 'EXQUISITE', 'EPIC', 'ELITE', 'UNIQUE', 'LEGENDARY', 'MYTHIC', 'DIVINE') NULL;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
