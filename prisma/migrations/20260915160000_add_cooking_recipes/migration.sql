-- Add the concrete cooking ingredient categories before migrating legacy values.
ALTER TABLE `Item` MODIFY `itemType` ENUM(
    'SWORD','AXE','FELLING_AXE','PICKAXE','BOW','CROSSBOW','STAFF','WAND','DAGGER','MACE','SPEAR','FLAIL',
    'HELMET','CHESTPLATE','GREAVES','BOOTS','GLOVES','PAULDRONS','BRACERS','BELT',
    'RING','AMULET','NECKLACE','BACKPACK',
    'ORE','INGOT','LOG','HERB','FISH','BAIT','HIDE','STONE','GEM',
    'POTION','FOOD','ELIXIR','SCROLL','SEED',
    'MATERIAL','INGREDIENT','MEAT','VEGETABLE','RECIPE',
    'QUEST_ITEM','KEY','CURRENCY','PET','MOUNT','OTHER'
) NULL;

UPDATE `Item`
SET `itemType` = 'VEGETABLE'
WHERE `itemType` = 'INGREDIENT';

-- Remove the vague legacy category after every existing row has been migrated.
ALTER TABLE `Item` MODIFY `itemType` ENUM(
    'SWORD','AXE','FELLING_AXE','PICKAXE','BOW','CROSSBOW','STAFF','WAND','DAGGER','MACE','SPEAR','FLAIL',
    'HELMET','CHESTPLATE','GREAVES','BOOTS','GLOVES','PAULDRONS','BRACERS','BELT',
    'RING','AMULET','NECKLACE','BACKPACK',
    'ORE','INGOT','LOG','HERB','FISH','BAIT','HIDE','STONE','GEM',
    'POTION','FOOD','ELIXIR','SCROLL','SEED',
    'MATERIAL','MEAT','VEGETABLE','RECIPE',
    'QUEST_ITEM','KEY','CURRENCY','PET','MOUNT','OTHER'
) NULL;

ALTER TABLE `VocationalResource`
ADD COLUMN `requiredRecipeItemId` INTEGER NULL;

ALTER TABLE `Item`
ADD COLUMN `foodEffectSeconds` INTEGER NULL;

CREATE TABLE `UserLearnedRecipe` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `recipeItemId` INTEGER NOT NULL,
    `learnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserLearnedRecipe_userId_idx`(`userId`),
    INDEX `UserLearnedRecipe_recipeItemId_idx`(`recipeItemId`),
    UNIQUE INDEX `UserLearnedRecipe_userId_recipeItemId_key`(`userId`, `recipeItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FoodEffectStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `statType` ENUM(
        'PHYSICAL_DAMAGE_MIN','PHYSICAL_DAMAGE_MAX','MAGIC_DAMAGE_MIN','MAGIC_DAMAGE_MAX',
        'CRITICAL_CHANCE','CRITICAL_DAMAGE','ATTACK_SPEED','ACCURACY','ARMOR','MAGIC_RESIST',
        'EVASION_MELEE','EVASION_RANGED','EVASION_MAGIC','BLOCK_CHANCE',
        'FIRE_RESIST','COLD_RESIST','LIGHTNING_RESIST','POISON_RESIST',
        'HEALTH','MANA','HEALTH_REGEN','MANA_REGEN','PRAYER_POINTS','MOVEMENT_SPEED',
        'LUCK','GOLD_FIND','EXPERIENCE_GAIN','LIFESTEAL','THORNS','CARRYING_CAPACITY',
        'WOODCUTTING_EFFICIENCY','MINING_EFFICIENCY','FISHING_EFFICIENCY'
    ) NOT NULL,
    `value` DOUBLE NOT NULL,

    INDEX `FoodEffectStat_itemId_idx`(`itemId`),
    UNIQUE INDEX `FoodEffectStat_itemId_statType_key`(`itemId`, `statType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserActiveFoodEffect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `itemId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserActiveFoodEffect_userId_key`(`userId`),
    INDEX `UserActiveFoodEffect_endsAt_idx`(`endsAt`),
    INDEX `UserActiveFoodEffect_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `VocationalResource_requiredRecipeItemId_idx`
ON `VocationalResource`(`requiredRecipeItemId`);

ALTER TABLE `VocationalResource`
ADD CONSTRAINT `VocationalResource_requiredRecipeItemId_fkey`
FOREIGN KEY (`requiredRecipeItemId`) REFERENCES `Item`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `UserLearnedRecipe`
ADD CONSTRAINT `UserLearnedRecipe_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserLearnedRecipe`
ADD CONSTRAINT `UserLearnedRecipe_recipeItemId_fkey`
FOREIGN KEY (`recipeItemId`) REFERENCES `Item`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `FoodEffectStat`
ADD CONSTRAINT `FoodEffectStat_itemId_fkey`
FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserActiveFoodEffect`
ADD CONSTRAINT `UserActiveFoodEffect_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserActiveFoodEffect`
ADD CONSTRAINT `UserActiveFoodEffect_itemId_fkey`
FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
