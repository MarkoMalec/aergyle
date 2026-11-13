-- Pity is replaced by the per-player fail stack (User.enchantFailStack).

-- DropForeignKey
ALTER TABLE `UserEnchantPity` DROP FOREIGN KEY `UserEnchantPity_userId_fkey`;

-- DropTable
DROP TABLE `UserEnchantPity`;

-- AlterTable
ALTER TABLE `EnchantConfig` DROP COLUMN `pityPerFailure`,
    DROP COLUMN `pityCap`;
