-- Per-item, per-stat, per-rarity rules can either replace the rarity
-- multiplier or specify an exact final value. Existing rows retain their
-- previous absolute-value meaning.
ALTER TABLE `ItemStatRarityOverride`
  ADD COLUMN `kind` ENUM('MULTIPLIER', 'ABSOLUTE') NOT NULL DEFAULT 'ABSOLUTE' AFTER `rarity`;

-- UserItemStat previously contained materialized copies of template-derived
-- stats. Those values are now resolved live from Item balance data. The table
-- remains (mapped as UserItemStatModifier) for genuine per-instance additions
-- such as future enchantments.
DELETE FROM `UserItemStat`;
