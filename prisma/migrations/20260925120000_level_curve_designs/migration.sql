-- CreateTable
CREATE TABLE `LevelCurveDesign` (
    `curve` ENUM('CHARACTER', 'SKILL') NOT NULL,
    `design` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`curve`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
