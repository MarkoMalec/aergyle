-- One global run length for every vocational skill, edited on /admin/vocations.
-- Additive: until a row is saved the game keeps its 8-hour code default.

-- CreateTable
CREATE TABLE `VocationConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `maxDurationSeconds` INTEGER NOT NULL DEFAULT 28800,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
