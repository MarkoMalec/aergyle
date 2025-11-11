-- AlterTable
ALTER TABLE `UserItem` ADD COLUMN `listedAt` DATETIME(3) NULL,
    ADD COLUMN `listedPrice` DOUBLE NULL,
    ADD COLUMN `status` ENUM('IN_INVENTORY', 'EQUIPPED', 'LISTED', 'SOLD', 'DELETED') NOT NULL DEFAULT 'IN_INVENTORY';

-- CreateIndex
CREATE INDEX `UserItem_status_idx` ON `UserItem`(`status`);

-- CreateIndex
CREATE INDEX `UserItem_status_listedAt_idx` ON `UserItem`(`status`, `listedAt`);

-- CreateIndex
CREATE INDEX `UserItem_userId_status_idx` ON `UserItem`(`userId`, `status`);
