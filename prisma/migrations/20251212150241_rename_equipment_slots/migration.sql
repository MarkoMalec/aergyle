-- This migration is written to be safe across different DB states:
-- - If legacy equipment columns still exist, it renames them to the new names.
-- - If the new columns already exist (partially applied state), it leaves them as-is.
-- - It migrates Item.equipTo string values and Item.itemType enum values.

SET @db := DATABASE();

-- Equipment: rename/add columns (non-destructive)

-- bracersItemId
SET @stmt := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'armsItemId'
    ) AND NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'bracersItemId'
    ),
    'ALTER TABLE `Equipment` CHANGE COLUMN `armsItemId` `bracersItemId` INTEGER NULL;',
    'SELECT 1;'
  )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'bracersItemId'
    ),
    'ALTER TABLE `Equipment` ADD COLUMN `bracersItemId` INTEGER NULL;',
    'SELECT 1;'
  )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- greavesItemId
SET @stmt := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'legsItemId'
    ) AND NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'greavesItemId'
    ),
    'ALTER TABLE `Equipment` CHANGE COLUMN `legsItemId` `greavesItemId` INTEGER NULL;',
    'SELECT 1;'
  )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'greavesItemId'
    ),
    'ALTER TABLE `Equipment` ADD COLUMN `greavesItemId` INTEGER NULL;',
    'SELECT 1;'
  )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- pauldronsItemId
SET @stmt := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'shouldersItemId'
    ) AND NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'pauldronsItemId'
    ),
    'ALTER TABLE `Equipment` CHANGE COLUMN `shouldersItemId` `pauldronsItemId` INTEGER NULL;',
    'SELECT 1;'
  )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := (
  SELECT IF(
    NOT EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'Equipment' AND COLUMN_NAME = 'pauldronsItemId'
    ),
    'ALTER TABLE `Equipment` ADD COLUMN `pauldronsItemId` INTEGER NULL;',
    'SELECT 1;'
  )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Item.equipTo: update legacy slot strings
UPDATE `Item` SET `equipTo` = 'pauldrons' WHERE `equipTo` IN ('shoulders', 'SHOULDERS');
UPDATE `Item` SET `equipTo` = 'bracers' WHERE `equipTo` IN ('arms', 'ARMS');
UPDATE `Item` SET `equipTo` = 'greaves' WHERE `equipTo` IN ('legs', 'LEGS');

-- Item.itemType: expand enum to include both old+new during migration
ALTER TABLE `Item` MODIFY `itemType` ENUM(
  'SWORD', 'AXE', 'BOW', 'CROSSBOW', 'STAFF', 'WAND', 'DAGGER', 'MACE', 'SPEAR', 'FLAIL',
  'HELMET', 'CHESTPLATE',
  'LEGGINGS', 'GREAVES',
  'BOOTS', 'GLOVES',
  'SHOULDERS', 'PAULDRONS',
  'BRACERS',
  'BELT', 'RING', 'AMULET', 'NECKLACE', 'BACKPACK',
  'ORE', 'LOG', 'HERB', 'FISH', 'HIDE', 'STONE', 'GEM',
  'POTION', 'FOOD', 'ELIXIR', 'SCROLL',
  'MATERIAL', 'INGREDIENT', 'RECIPE',
  'QUEST_ITEM', 'KEY', 'CURRENCY',
  'PET', 'MOUNT', 'OTHER'
) NULL;

-- Item.itemType: migrate legacy values
UPDATE `Item` SET `itemType` = 'PAULDRONS' WHERE `itemType` = 'SHOULDERS';
UPDATE `Item` SET `itemType` = 'GREAVES' WHERE `itemType` = 'LEGGINGS';

-- Item.itemType: finalize enum (matches Prisma schema)
ALTER TABLE `Item` MODIFY `itemType` ENUM(
  'SWORD', 'AXE', 'BOW', 'CROSSBOW', 'STAFF', 'WAND', 'DAGGER', 'MACE', 'SPEAR', 'FLAIL',
  'HELMET', 'CHESTPLATE', 'GREAVES', 'BOOTS', 'GLOVES', 'PAULDRONS', 'BRACERS', 'BELT',
  'RING', 'AMULET', 'NECKLACE', 'BACKPACK',
  'ORE', 'LOG', 'HERB', 'FISH', 'HIDE', 'STONE', 'GEM',
  'POTION', 'FOOD', 'ELIXIR', 'SCROLL',
  'MATERIAL', 'INGREDIENT', 'RECIPE',
  'QUEST_ITEM', 'KEY', 'CURRENCY',
  'PET', 'MOUNT', 'OTHER'
) NULL;
