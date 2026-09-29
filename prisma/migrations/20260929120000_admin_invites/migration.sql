-- AlterTable
ALTER TABLE `AdminUser` ADD COLUMN `setupExpiresAt` DATETIME(3) NULL,
    MODIFY `totpSecret` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `AdminSession` ADD COLUMN `pendingTotpSecret` VARCHAR(255) NULL,
    ADD COLUMN `scope` ENUM('FULL', 'SETUP') NOT NULL DEFAULT 'FULL';
