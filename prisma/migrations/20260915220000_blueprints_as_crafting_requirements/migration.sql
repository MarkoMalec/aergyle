-- Blueprints are physical crafting inputs, distinct from learnable recipes.
ALTER TABLE `Item` MODIFY `itemType` ENUM(
    'SWORD','AXE','FELLING_AXE','PICKAXE','BOW','CROSSBOW','STAFF','WAND','DAGGER','MACE','SPEAR','FLAIL',
    'HELMET','CHESTPLATE','GREAVES','BOOTS','GLOVES','PAULDRONS','BRACERS','BELT',
    'RING','AMULET','NECKLACE','BACKPACK',
    'ORE','INGOT','LOG','HERB','FISH','BAIT','HIDE','STONE','GEM',
    'POTION','FOOD','ELIXIR','SCROLL','SEED',
    'MATERIAL','MEAT','VEGETABLE','RECIPE','BLUEPRINT',
    'QUEST_ITEM','KEY','CURRENCY','PET','MOUNT','OTHER'
) NULL;

UPDATE `Item`
SET `itemType` = 'BLUEPRINT'
WHERE `name` IN (
    'Blueprint: Fieldweave Gloves',
    'Blueprint: Fieldweave Trailboots',
    'Blueprint: Fieldweave Leggings',
    'Blueprint: Fieldweave Tunic'
);

-- Preserve already-seeded blueprint links as ordinary quantity-one inputs
-- before removing the incorrect permanent-knowledge gate.
INSERT INTO `VocationalRequirement` (`resourceId`, `itemId`, `quantityPerUnit`)
SELECT `id`, `requiredRecipeItemId`, 1
FROM `VocationalResource`
WHERE `actionType` = 'TAILORING'
  AND `requiredRecipeItemId` IS NOT NULL
ON DUPLICATE KEY UPDATE `quantityPerUnit` = 1;

UPDATE `VocationalResource`
SET `requiredRecipeItemId` = NULL
WHERE `actionType` = 'TAILORING';

DELETE `learned`
FROM `UserLearnedRecipe` AS `learned`
INNER JOIN `Item` AS `item` ON `item`.`id` = `learned`.`recipeItemId`
WHERE `item`.`itemType` = 'BLUEPRINT';
