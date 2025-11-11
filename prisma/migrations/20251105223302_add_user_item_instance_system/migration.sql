-- AlterTable
ALTER TABLE `Equipment` ADD COLUMN `amuletItemId` INTEGER NULL,
    ADD COLUMN `armsItemId` INTEGER NULL,
    ADD COLUMN `backpackItemId` INTEGER NULL,
    ADD COLUMN `beltItemId` INTEGER NULL,
    ADD COLUMN `bootsItemId` INTEGER NULL,
    ADD COLUMN `chestItemId` INTEGER NULL,
    ADD COLUMN `glovesItemId` INTEGER NULL,
    ADD COLUMN `headItemId` INTEGER NULL,
    ADD COLUMN `legsItemId` INTEGER NULL,
    ADD COLUMN `necklaceItemId` INTEGER NULL,
    ADD COLUMN `ring1ItemId` INTEGER NULL,
    ADD COLUMN `ring2ItemId` INTEGER NULL,
    ADD COLUMN `shouldersItemId` INTEGER NULL,
    ADD COLUMN `weaponItemId` INTEGER NULL;

-- CreateTable
CREATE TABLE `UserItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `itemId` INTEGER NOT NULL,
    `rarity` ENUM('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'UNIQUE', 'LEGENDARY', 'MYTHIC') NOT NULL DEFAULT 'COMMON',
    `acquiredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isTradeable` BOOLEAN NOT NULL DEFAULT true,
    `isEquipped` BOOLEAN NOT NULL DEFAULT false,

    INDEX `UserItem_userId_idx`(`userId`),
    INDEX `UserItem_itemId_idx`(`itemId`),
    INDEX `UserItem_userId_isEquipped_idx`(`userId`, `isEquipped`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserItemStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userItemId` INTEGER NOT NULL,
    `statType` ENUM('PHYSICAL_DAMAGE_MIN', 'PHYSICAL_DAMAGE_MAX', 'MAGIC_DAMAGE_MIN', 'MAGIC_DAMAGE_MAX', 'CRITICAL_CHANCE', 'CRITICAL_DAMAGE', 'ATTACK_SPEED', 'ACCURACY', 'ARMOR', 'MAGIC_RESIST', 'EVASION_MELEE', 'EVASION_RANGED', 'EVASION_MAGIC', 'BLOCK_CHANCE', 'FIRE_RESIST', 'COLD_RESIST', 'LIGHTNING_RESIST', 'POISON_RESIST', 'HEALTH', 'MANA', 'HEALTH_REGEN', 'MANA_REGEN', 'PRAYER_POINTS', 'MOVEMENT_SPEED', 'LUCK', 'GOLD_FIND', 'EXPERIENCE_GAIN', 'LIFESTEAL', 'THORNS') NOT NULL,
    `value` DOUBLE NOT NULL,

    INDEX `UserItemStat_userItemId_idx`(`userItemId`),
    UNIQUE INDEX `UserItemStat_userItemId_statType_key`(`userItemId`, `statType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventorySlot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inventoryId` INTEGER NOT NULL,
    `slotIndex` INTEGER NOT NULL,
    `userItemId` INTEGER NULL,

    INDEX `InventorySlot_inventoryId_idx`(`inventoryId`),
    INDEX `InventorySlot_userItemId_idx`(`userItemId`),
    UNIQUE INDEX `InventorySlot_inventoryId_slotIndex_key`(`inventoryId`, `slotIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserItem` ADD CONSTRAINT `UserItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserItem` ADD CONSTRAINT `UserItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserItemStat` ADD CONSTRAINT `UserItemStat_userItemId_fkey` FOREIGN KEY (`userItemId`) REFERENCES `UserItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventorySlot` ADD CONSTRAINT `InventorySlot_inventoryId_fkey` FOREIGN KEY (`inventoryId`) REFERENCES `Inventory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventorySlot` ADD CONSTRAINT `InventorySlot_userItemId_fkey` FOREIGN KEY (`userItemId`) REFERENCES `UserItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
