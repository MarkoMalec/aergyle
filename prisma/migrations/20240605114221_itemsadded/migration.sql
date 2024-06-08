/*
  Warnings:

  - You are about to drop the column `inventory` on the `Inventory` table. All the data in the column will be lost.
  - You are about to drop the column `inventory_order` on the `Inventory` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Inventory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Inventory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Inventory` DROP FOREIGN KEY `userid_inv`;

-- AlterTable
ALTER TABLE `Inventory` DROP COLUMN `inventory`,
    DROP COLUMN `inventory_order`,
    DROP COLUMN `user_id`,
    ADD COLUMN `maxSlots` INTEGER NOT NULL DEFAULT 20,
    ADD COLUMN `userId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `Item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `stat1` VARCHAR(191) NOT NULL,
    `stat2` VARCHAR(191) NULL,
    `price` DOUBLE NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventorySlot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inventoryId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `slotIndex` INTEGER NOT NULL,

    UNIQUE INDEX `InventorySlot_itemId_key`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Inventory_userId_key` ON `Inventory`(`userId`);

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventorySlot` ADD CONSTRAINT `InventorySlot_inventoryId_fkey` FOREIGN KEY (`inventoryId`) REFERENCES `Inventory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventorySlot` ADD CONSTRAINT `InventorySlot_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
