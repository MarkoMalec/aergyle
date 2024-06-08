/*
  Warnings:

  - You are about to drop the `InventorySlot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `InventorySlot` DROP FOREIGN KEY `InventorySlot_inventoryId_fkey`;

-- DropForeignKey
ALTER TABLE `InventorySlot` DROP FOREIGN KEY `InventorySlot_itemId_fkey`;

-- AlterTable
ALTER TABLE `Inventory` ADD COLUMN `slots` JSON NOT NULL;

-- DropTable
DROP TABLE `InventorySlot`;
