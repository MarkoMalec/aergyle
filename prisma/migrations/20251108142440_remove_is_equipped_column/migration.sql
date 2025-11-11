/*
  Warnings:

  - You are about to drop the column `isEquipped` on the `UserItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `UserItem_userId_isEquipped_idx` ON `UserItem`;

-- AlterTable
ALTER TABLE `UserItem` DROP COLUMN `isEquipped`;
