-- Per-skill item-type rules move from src/game/crafting.ts into the database so
-- they can be edited on /admin/vocations/rules. The crafting skills keep the
-- rules they had in code, and Alchemy also accepts POTION outputs. Every other
-- skill has no row, which accepts every item type, as before.

-- CreateTable
CREATE TABLE `VocationalSkillRule` (
    `actionType` ENUM('WOODCUTTING', 'MINING', 'FISHING', 'GARDENING', 'GATHERING', 'HUNTING', 'ALCHEMY', 'BLACKSMITHING', 'WEAPONSMITHING', 'CARPENTRY', 'COOKING', 'TAILORING', 'FORGE') NOT NULL,
    `outputItemTypes` JSON NOT NULL,
    `inputItemTypes` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`actionType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `VocationalSkillRule` (`actionType`, `outputItemTypes`, `inputItemTypes`, `updatedAt`) VALUES
('COOKING',
 '["FOOD"]',
 '["FISH","MEAT","VEGETABLE"]',
 CURRENT_TIMESTAMP(3)),
('ALCHEMY',
 '["POTION","MATERIAL"]',
 '["HERB","HIDE","MATERIAL"]',
 CURRENT_TIMESTAMP(3)),
('BLACKSMITHING',
 '["FELLING_AXE","PICKAXE","HOE","SHIELD","HELMET","CHESTPLATE","GREAVES","BOOTS","GLOVES","PAULDRONS","BRACERS","BELT","INGOT","MATERIAL","OTHER"]',
 '["ORE","INGOT","HIDE","MATERIAL","BLUEPRINT"]',
 CURRENT_TIMESTAMP(3)),
('WEAPONSMITHING',
 '["SWORD","GREATSWORD","AXE","GREATAXE","DAGGER","MACE","SPEAR","FLAIL","MATERIAL"]',
 '["INGOT","HIDE","MATERIAL","BLUEPRINT"]',
 CURRENT_TIMESTAMP(3)),
('CARPENTRY',
 '["FISHING_ROD","BOW","CROSSBOW","HELMET","CHESTPLATE","GREAVES","BOOTS","GLOVES","PAULDRONS","BRACERS","BELT","MATERIAL","OTHER"]',
 '["INGOT","LOG","HIDE","MATERIAL","BLUEPRINT"]',
 CURRENT_TIMESTAMP(3)),
('TAILORING',
 '["HELMET","CHESTPLATE","GREAVES","BOOTS","GLOVES","PAULDRONS","BRACERS","BELT","HIDE","MATERIAL"]',
 '["FISH","HIDE","MATERIAL","BLUEPRINT"]',
 CURRENT_TIMESTAMP(3));
