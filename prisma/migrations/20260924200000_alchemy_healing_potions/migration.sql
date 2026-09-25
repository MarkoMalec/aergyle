-- Healing potions restore live CharacterHealth immediately rather than adding
-- a temporary maximum-health stat. Null keeps existing timed consumables
-- unchanged.
ALTER TABLE `Item`
ADD COLUMN `healingAmount` INTEGER NULL;
