-- Settlement storage: a chest a player rents once per settlement, with gold,
-- and keeps items in. Stored items leave the inventory slots and become
-- UserItem rows with status IN_STORAGE, held by that player's storage row.

-- AlterEnum
ALTER TABLE `UserItem` MODIFY `status` ENUM('IN_INVENTORY', 'IN_STORAGE', 'EQUIPPED', 'LISTED', 'SOLD', 'DELETED') NOT NULL DEFAULT 'IN_INVENTORY';

-- CreateTable
CREATE TABLE `StorageConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `icon` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SettlementStorage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `settlementId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Storage',
    `description` TEXT NULL,
    `unlockCost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `slots` INTEGER NOT NULL DEFAULT 10,
    `mapX` DOUBLE NULL,
    `mapY` DOUBLE NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SettlementStorage_settlementId_key`(`settlementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserStorage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `storageId` INTEGER NOT NULL,
    `unlockedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserStorage_storageId_idx`(`storageId`),
    UNIQUE INDEX `UserStorage_userId_storageId_key`(`userId`, `storageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `UserItem` ADD COLUMN `userStorageId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `UserItem_userStorageId_idx` ON `UserItem`(`userStorageId`);

-- AddForeignKey
ALTER TABLE `SettlementStorage` ADD CONSTRAINT `SettlementStorage_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserStorage` ADD CONSTRAINT `UserStorage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserStorage` ADD CONSTRAINT `UserStorage_storageId_fkey` FOREIGN KEY (`storageId`) REFERENCES `SettlementStorage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserItem` ADD CONSTRAINT `UserItem_userStorageId_fkey` FOREIGN KEY (`userStorageId`) REFERENCES `UserStorage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
