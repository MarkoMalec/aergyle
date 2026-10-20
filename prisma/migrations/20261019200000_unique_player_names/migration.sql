-- Player names are unique (case- and accent-insensitive, per the column's
-- utf8mb4_unicode_ci collation) and required: they are the profile URL, /@Name.
-- Checked before writing: 11 players, no empty and no duplicate names.

-- AlterTable
ALTER TABLE `User` MODIFY `name` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_name_key` ON `User`(`name`);

