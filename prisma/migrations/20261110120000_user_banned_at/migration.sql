-- Admin bans. Additive: every existing player stays unbanned (NULL).

-- AlterTable
ALTER TABLE `User` ADD COLUMN `bannedAt` DATETIME(3) NULL;
