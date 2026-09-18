-- Base travel time per location pair (undirected, lower id first). Pairs
-- without a row use TravelConfig.secondsPerTravel.

-- CreateTable
CREATE TABLE `TravelRoute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locationAId` INTEGER NOT NULL,
    `locationBId` INTEGER NOT NULL,
    `seconds` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TravelRoute_locationBId_idx`(`locationBId`),
    UNIQUE INDEX `TravelRoute_locationAId_locationBId_key`(`locationAId`, `locationBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TravelRoute` ADD CONSTRAINT `TravelRoute_locationAId_fkey` FOREIGN KEY (`locationAId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TravelRoute` ADD CONSTRAINT `TravelRoute_locationBId_fkey` FOREIGN KEY (`locationBId`) REFERENCES `Location`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

