-- Rename Smelting without losing active actions, progression or historical XP,
-- then add the two new crafting professions to the shared vocation engine.

-- MySQL enum values must be expanded before stored SMELTING values can be
-- rewritten to BLACKSMITHING.
ALTER TABLE `ToolEfficiency` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NOT NULL;

ALTER TABLE `VocationalResource` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NOT NULL;

ALTER TABLE `UserVocationalActivity` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NOT NULL;

ALTER TABLE `XpMultiplier` MODIFY `vocationalActionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NULL;

ALTER TABLE `XpTransaction` MODIFY `vocationalActionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NULL;

UPDATE `ToolEfficiency`
SET `actionType` = 'BLACKSMITHING'
WHERE `actionType` = 'SMELTING';

UPDATE `VocationalResource`
SET `actionType` = 'BLACKSMITHING'
WHERE `actionType` = 'SMELTING';

UPDATE `UserVocationalActivity`
SET `actionType` = 'BLACKSMITHING'
WHERE `actionType` = 'SMELTING';

UPDATE `XpMultiplier`
SET `vocationalActionType` = 'BLACKSMITHING'
WHERE `vocationalActionType` = 'SMELTING';

UPDATE `XpTransaction`
SET `vocationalActionType` = 'BLACKSMITHING'
WHERE `vocationalActionType` = 'SMELTING';

UPDATE `UserTrackProgress`
SET `trackKey` = 'BLACKSMITHING'
WHERE `trackType` = 'SKILL' AND `trackKey` = 'SMELTING';

UPDATE `skills`
SET
  `skill_name` = 'Blacksmithing',
  `description` = 'Refine ores into ingots and shape metal into armor, tools and durable components.',
  `category` = 'CRAFTING'
WHERE `skill_name` = 'Smelting';

INSERT INTO `skills` (`skill_name`, `description`, `category`)
VALUES
  ('Blacksmithing', 'Refine ores into ingots and shape metal into armor, tools and durable components.', 'CRAFTING'),
  ('Weaponsmithing', 'Forge fitted components into swords, daggers, maces, spears and axes.', 'CRAFTING'),
  ('Carpentry', 'Shape timber into planks, handles, shafts, bows and practical wooden items.', 'CRAFTING')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `category` = VALUES(`category`);

-- Once every stored value has moved, remove the legacy enum member.
ALTER TABLE `ToolEfficiency` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NOT NULL;

ALTER TABLE `VocationalResource` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NOT NULL;

ALTER TABLE `UserVocationalActivity` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NOT NULL;

ALTER TABLE `XpMultiplier` MODIFY `vocationalActionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NULL;

ALTER TABLE `XpTransaction` MODIFY `vocationalActionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY',
  'BLACKSMITHING','WEAPONSMITHING','CARPENTRY','COOKING','TAILORING','FORGE'
) NULL;
