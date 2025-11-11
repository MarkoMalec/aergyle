/*
  Warnings:

  - You are about to drop the column `amulet` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `arms` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `backpack` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `belt` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `boots` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `chest` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `gloves` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `head` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `legs` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `necklace` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `ring1` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `ring2` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `shoulders` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `weapon` on the `Equipment` table. All the data in the column will be lost.
  - You are about to drop the column `stat1` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `stat2` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the `InventorySlot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `InventorySlot` DROP FOREIGN KEY `InventorySlot_inventoryId_fkey`;

-- DropForeignKey
ALTER TABLE `InventorySlot` DROP FOREIGN KEY `InventorySlot_userItemId_fkey`;

-- AlterTable
ALTER TABLE `Equipment` DROP COLUMN `amulet`,
    DROP COLUMN `arms`,
    DROP COLUMN `backpack`,
    DROP COLUMN `belt`,
    DROP COLUMN `boots`,
    DROP COLUMN `chest`,
    DROP COLUMN `gloves`,
    DROP COLUMN `head`,
    DROP COLUMN `legs`,
    DROP COLUMN `necklace`,
    DROP COLUMN `ring1`,
    DROP COLUMN `ring2`,
    DROP COLUMN `shoulders`,
    DROP COLUMN `weapon`;

-- AlterTable
ALTER TABLE `Item` DROP COLUMN `stat1`,
    DROP COLUMN `stat2`;

-- DropTable
DROP TABLE `InventorySlot`;
