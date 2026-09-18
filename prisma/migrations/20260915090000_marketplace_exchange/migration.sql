-- CreateTable
CREATE TABLE `MarketBuyOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `itemId` INTEGER NOT NULL,
    `rarity` ENUM('WORTHLESS', 'BROKEN', 'COMMON', 'UNCOMMON', 'RARE', 'EXQUISITE', 'EPIC', 'ELITE', 'UNIQUE', 'LEGENDARY', 'MYTHIC', 'DIVINE') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `remainingQuantity` INTEGER NOT NULL,
    `pricePerItem` DECIMAL(10, 2) NOT NULL,
    `reservedGold` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('OPEN', 'FILLED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MarketBuyOrder_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `MarketBuyOrder_itemId_rarity_status_pricePerItem_createdAt_idx`(`itemId`, `rarity`, `status`, `pricePerItem`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `buyerId` VARCHAR(191) NULL,
    `sellerId` VARCHAR(191) NULL,
    `itemId` INTEGER NOT NULL,
    `rarity` ENUM('WORTHLESS', 'BROKEN', 'COMMON', 'UNCOMMON', 'RARE', 'EXQUISITE', 'EPIC', 'ELITE', 'UNIQUE', 'LEGENDARY', 'MYTHIC', 'DIVINE') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `grossAmount` DECIMAL(10, 2) NOT NULL,
    `taxAmount` DECIMAL(10, 2) NOT NULL,
    `netAmount` DECIMAL(10, 2) NOT NULL,
    `source` ENUM('BUY_NOW', 'SELL_NOW') NOT NULL,
    `executedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MarketTransaction_itemId_rarity_executedAt_idx`(`itemId`, `rarity`, `executedAt`),
    INDEX `MarketTransaction_buyerId_executedAt_idx`(`buyerId`, `executedAt`),
    INDEX `MarketTransaction_sellerId_executedAt_idx`(`sellerId`, `executedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MarketBuyOrder` ADD CONSTRAINT `MarketBuyOrder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketBuyOrder` ADD CONSTRAINT `MarketBuyOrder_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketTransaction` ADD CONSTRAINT `MarketTransaction_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketTransaction` ADD CONSTRAINT `MarketTransaction_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketTransaction` ADD CONSTRAINT `MarketTransaction_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
