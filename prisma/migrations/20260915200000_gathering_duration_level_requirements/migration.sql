ALTER TABLE `GatheringDuration`
  ADD COLUMN `requiredGatheringLevel` INTEGER NOT NULL DEFAULT 0 AFTER `xpReward`;

UPDATE `GatheringDuration`
SET `requiredGatheringLevel` = CASE `durationSeconds`
  WHEN 3600 THEN 0
  WHEN 7200 THEN 15
  WHEN 10800 THEN 50
  WHEN 14400 THEN 100
  ELSE `requiredGatheringLevel`
END;
