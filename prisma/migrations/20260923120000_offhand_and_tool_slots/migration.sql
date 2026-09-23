-- Off-hand, fishing rod and hoe equipment slots, plus a two-handed flag on
-- weapons. A two-handed weapon takes the main hand and keeps the off hand empty.
-- Existing weapons stay one-handed until an admin marks them.

-- AlterTable
ALTER TABLE `Equipment` ADD COLUMN `fishingRodItemId` INTEGER NULL,
    ADD COLUMN `hoeItemId` INTEGER NULL,
    ADD COLUMN `offhandItemId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Item` ADD COLUMN `twoHanded` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `equipTo` ENUM('head', 'necklace', 'chest', 'pauldrons', 'bracers', 'gloves', 'greaves', 'boots', 'belt', 'ring', 'amulet', 'backpack', 'weapon', 'offhand', 'fellingAxe', 'pickaxe', 'fishingRod', 'hoe') NULL,
    MODIFY `itemType` ENUM('SWORD', 'GREATSWORD', 'AXE', 'GREATAXE', 'FELLING_AXE', 'PICKAXE', 'FISHING_ROD', 'HOE', 'BOW', 'CROSSBOW', 'STAFF', 'WAND', 'DAGGER', 'MACE', 'SPEAR', 'FLAIL', 'SHIELD', 'HELMET', 'CHESTPLATE', 'GREAVES', 'BOOTS', 'GLOVES', 'PAULDRONS', 'BRACERS', 'BELT', 'RING', 'AMULET', 'NECKLACE', 'BACKPACK', 'ORE', 'INGOT', 'LOG', 'HERB', 'FISH', 'BAIT', 'HIDE', 'STONE', 'GEM', 'POTION', 'FOOD', 'ELIXIR', 'SCROLL', 'SEED', 'MATERIAL', 'MEAT', 'VEGETABLE', 'RECIPE', 'BLUEPRINT', 'QUEST_ITEM', 'KEY', 'CURRENCY', 'PET', 'MOUNT', 'OTHER') NULL;
