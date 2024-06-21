-- CreateTable
CREATE TABLE `Equipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `head` INTEGER NULL,
    `chest` INTEGER NULL,
    `belt` INTEGER NULL,
    `legs` INTEGER NULL,
    `boots` INTEGER NULL,
    `necklace` INTEGER NULL,
    `ring1` INTEGER NULL,
    `ring2` INTEGER NULL,
    `amulet` INTEGER NULL,

    UNIQUE INDEX `Equipment_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
