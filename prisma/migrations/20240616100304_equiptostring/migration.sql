/*
  Warnings:

  - You are about to alter the column `equipTo` on the `Item` table. The data in that column could be lost. The data in that column will be cast from `Double` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `Item` MODIFY `equipTo` VARCHAR(191) NULL;
