-- AlterTable
ALTER TABLE `Item` ADD COLUMN `armor` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `maxMagicDamage` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `maxPhysicalDamage` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `minMagicDamage` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `minPhysicalDamage` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `rarity` ENUM('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL DEFAULT 'COMMON',
    ADD COLUMN `requiredLevel` INTEGER NULL DEFAULT 1,
    MODIFY `stat1` VARCHAR(191) NULL,
    MODIFY `stat2` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ItemStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `statType` ENUM('PHYSICAL_DAMAGE_MIN', 'PHYSICAL_DAMAGE_MAX', 'MAGIC_DAMAGE_MIN', 'MAGIC_DAMAGE_MAX', 'CRITICAL_CHANCE', 'CRITICAL_DAMAGE', 'ATTACK_SPEED', 'ACCURACY', 'ARMOR', 'MAGIC_RESIST', 'EVASION_MELEE', 'EVASION_RANGED', 'EVASION_MAGIC', 'BLOCK_CHANCE', 'FIRE_RESIST', 'COLD_RESIST', 'LIGHTNING_RESIST', 'POISON_RESIST', 'HEALTH', 'MANA', 'HEALTH_REGEN', 'MANA_REGEN', 'PRAYER_POINTS', 'MOVEMENT_SPEED', 'LUCK', 'GOLD_FIND', 'EXPERIENCE_GAIN', 'LIFESTEAL', 'THORNS') NOT NULL,
    `value` DOUBLE NOT NULL,

    INDEX `ItemStat_statType_value_idx`(`statType`, `value`),
    UNIQUE INDEX `ItemStat_itemId_statType_key`(`itemId`, `statType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterBaseStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `statType` ENUM('PHYSICAL_DAMAGE_MIN', 'PHYSICAL_DAMAGE_MAX', 'MAGIC_DAMAGE_MIN', 'MAGIC_DAMAGE_MAX', 'CRITICAL_CHANCE', 'CRITICAL_DAMAGE', 'ATTACK_SPEED', 'ACCURACY', 'ARMOR', 'MAGIC_RESIST', 'EVASION_MELEE', 'EVASION_RANGED', 'EVASION_MAGIC', 'BLOCK_CHANCE', 'FIRE_RESIST', 'COLD_RESIST', 'LIGHTNING_RESIST', 'POISON_RESIST', 'HEALTH', 'MANA', 'HEALTH_REGEN', 'MANA_REGEN', 'PRAYER_POINTS', 'MOVEMENT_SPEED', 'LUCK', 'GOLD_FIND', 'EXPERIENCE_GAIN', 'LIFESTEAL', 'THORNS') NOT NULL,
    `value` DOUBLE NOT NULL,

    INDEX `CharacterBaseStat_userId_idx`(`userId`),
    UNIQUE INDEX `CharacterBaseStat_userId_statType_key`(`userId`, `statType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Item_minPhysicalDamage_idx` ON `Item`(`minPhysicalDamage`);

-- CreateIndex
CREATE INDEX `Item_maxPhysicalDamage_idx` ON `Item`(`maxPhysicalDamage`);

-- CreateIndex
CREATE INDEX `Item_minMagicDamage_idx` ON `Item`(`minMagicDamage`);

-- CreateIndex
CREATE INDEX `Item_armor_idx` ON `Item`(`armor`);

-- CreateIndex
CREATE INDEX `Item_requiredLevel_idx` ON `Item`(`requiredLevel`);

-- CreateIndex
CREATE INDEX `Item_rarity_idx` ON `Item`(`rarity`);

-- AddForeignKey
ALTER TABLE `ItemStat` ADD CONSTRAINT `ItemStat_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterBaseStat` ADD CONSTRAINT `CharacterBaseStat_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
