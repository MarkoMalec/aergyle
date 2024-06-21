/*
  Warnings:

  - Made the column `stat2` on table `Item` required. This step will fail if there are existing NULL values in that column.
  - Made the column `sprite` on table `Item` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Item` MODIFY `stat2` VARCHAR(191) NOT NULL,
    MODIFY `sprite` VARCHAR(191) NOT NULL;
