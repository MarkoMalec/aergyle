-- Recovery for a database where
-- 20260915190000_gardening_and_gathering_expeditions stopped at query 30 with
-- MariaDB error 1052 (ambiguous `level`). Queries 1-29 contain the schema DDL
-- and have already been committed by MySQL/MariaDB. This idempotent script
-- completes only the remaining skill/progression data migration.

INSERT INTO `skills` (`skill_name`, `description`)
VALUES ('Gardening', 'Plant seeds, tend individual plots, and harvest ripe crops.')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

INSERT INTO `skills` (`skill_name`, `description`)
VALUES ('Gathering', 'Explore known locations on timed expeditions and return with a varied haul.')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

SET @gardeningSkillId := (
  SELECT `skill_id` FROM `skills` WHERE `skill_name` = 'Gardening' LIMIT 1
);
SET @gatheringSkillId := (
  SELECT `skill_id` FROM `skills` WHERE `skill_name` = 'Gathering' LIMIT 1
);

INSERT INTO `user_skills` (`user_id`, `skill_id`, `level`, `current_xp`, `updated_at`)
SELECT
  legacy_gathering.`user_id`,
  @gardeningSkillId,
  legacy_gathering.`level`,
  legacy_gathering.`current_xp`,
  CURRENT_TIMESTAMP()
FROM `user_skills` AS legacy_gathering
WHERE legacy_gathering.`skill_id` = @gatheringSkillId
ON DUPLICATE KEY UPDATE
  `level` = GREATEST(`user_skills`.`level`, VALUES(`level`)),
  `current_xp` = GREATEST(`user_skills`.`current_xp`, VALUES(`current_xp`)),
  `updated_at` = CURRENT_TIMESTAMP();

UPDATE `user_skills`
SET `level` = 1, `current_xp` = 0, `updated_at` = CURRENT_TIMESTAMP()
WHERE `skill_id` = @gatheringSkillId;

INSERT INTO `UserTrackProgress`
  (`userId`, `trackType`, `trackKey`, `level`, `experience`, `createdAt`, `updatedAt`)
SELECT
  us.`user_id`,
  'SKILL',
  'GARDENING',
  us.`level`,
  COALESCE(thresholds.`xpTotal`, 0) + us.`current_xp`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `user_skills` us
LEFT JOIN `TrackXpThreshold` thresholds
  ON thresholds.`trackType` = 'SKILL' AND thresholds.`level` = us.`level`
WHERE us.`skill_id` = @gardeningSkillId
ON DUPLICATE KEY UPDATE
  `level` = GREATEST(`UserTrackProgress`.`level`, VALUES(`level`)),
  `experience` = GREATEST(`UserTrackProgress`.`experience`, VALUES(`experience`)),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `UserTrackProgress`
  (`userId`, `trackType`, `trackKey`, `level`, `experience`, `createdAt`, `updatedAt`)
SELECT
  legacy_gathering_progress.`userId`,
  'SKILL',
  'GARDENING',
  legacy_gathering_progress.`level`,
  legacy_gathering_progress.`experience`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `UserTrackProgress` AS legacy_gathering_progress
WHERE legacy_gathering_progress.`trackType` = 'SKILL'
  AND legacy_gathering_progress.`trackKey` = 'GATHERING'
ON DUPLICATE KEY UPDATE
  `level` = GREATEST(`UserTrackProgress`.`level`, VALUES(`level`)),
  `experience` = GREATEST(`UserTrackProgress`.`experience`, VALUES(`experience`)),
  `updatedAt` = CURRENT_TIMESTAMP(3);

UPDATE `UserTrackProgress`
SET `level` = 1, `experience` = 0, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `trackType` = 'SKILL' AND `trackKey` = 'GATHERING';
