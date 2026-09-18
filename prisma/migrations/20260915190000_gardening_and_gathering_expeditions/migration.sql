-- Split the former garden-shaped Gathering skill into Gardening and a separate
-- expedition vocation. Enum changes are additive so existing rows remain valid.

ALTER TABLE `ToolEfficiency` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING','COOKING','FORGE'
) NOT NULL;

ALTER TABLE `VocationalResource` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING','COOKING','FORGE'
) NOT NULL;

ALTER TABLE `UserVocationalActivity` MODIFY `actionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING','COOKING','FORGE'
) NOT NULL;

ALTER TABLE `XpMultiplier` MODIFY `vocationalActionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING','COOKING','FORGE'
) NULL;

ALTER TABLE `XpTransaction` MODIFY `vocationalActionType` ENUM(
  'WOODCUTTING','MINING','FISHING','GARDENING','GATHERING','ALCHEMY','SMELTING','COOKING','FORGE'
) NULL;

ALTER TABLE `CharacterBaseStat` MODIFY `statType` ENUM(
  'PHYSICAL_DAMAGE_MIN','PHYSICAL_DAMAGE_MAX','MAGIC_DAMAGE_MIN','MAGIC_DAMAGE_MAX',
  'CRITICAL_CHANCE','CRITICAL_DAMAGE','ATTACK_SPEED','ACCURACY','ARMOR','MAGIC_RESIST',
  'EVASION_MELEE','EVASION_RANGED','EVASION_MAGIC','BLOCK_CHANCE',
  'FIRE_RESIST','COLD_RESIST','LIGHTNING_RESIST','POISON_RESIST',
  'HEALTH','MANA','HEALTH_REGEN','MANA_REGEN','PRAYER_POINTS','MOVEMENT_SPEED',
  'LUCK','GOLD_FIND','EXPERIENCE_GAIN','LIFESTEAL','THORNS','CARRYING_CAPACITY',
  'WOODCUTTING_EFFICIENCY','MINING_EFFICIENCY','FISHING_EFFICIENCY','GATHERING_EFFICIENCY'
) NOT NULL;

ALTER TABLE `ItemStat` MODIFY `statType` ENUM(
  'PHYSICAL_DAMAGE_MIN','PHYSICAL_DAMAGE_MAX','MAGIC_DAMAGE_MIN','MAGIC_DAMAGE_MAX',
  'CRITICAL_CHANCE','CRITICAL_DAMAGE','ATTACK_SPEED','ACCURACY','ARMOR','MAGIC_RESIST',
  'EVASION_MELEE','EVASION_RANGED','EVASION_MAGIC','BLOCK_CHANCE',
  'FIRE_RESIST','COLD_RESIST','LIGHTNING_RESIST','POISON_RESIST',
  'HEALTH','MANA','HEALTH_REGEN','MANA_REGEN','PRAYER_POINTS','MOVEMENT_SPEED',
  'LUCK','GOLD_FIND','EXPERIENCE_GAIN','LIFESTEAL','THORNS','CARRYING_CAPACITY',
  'WOODCUTTING_EFFICIENCY','MINING_EFFICIENCY','FISHING_EFFICIENCY','GATHERING_EFFICIENCY'
) NOT NULL;

ALTER TABLE `ItemStatProgression` MODIFY `statType` ENUM(
  'PHYSICAL_DAMAGE_MIN','PHYSICAL_DAMAGE_MAX','MAGIC_DAMAGE_MIN','MAGIC_DAMAGE_MAX',
  'CRITICAL_CHANCE','CRITICAL_DAMAGE','ATTACK_SPEED','ACCURACY','ARMOR','MAGIC_RESIST',
  'EVASION_MELEE','EVASION_RANGED','EVASION_MAGIC','BLOCK_CHANCE',
  'FIRE_RESIST','COLD_RESIST','LIGHTNING_RESIST','POISON_RESIST',
  'HEALTH','MANA','HEALTH_REGEN','MANA_REGEN','PRAYER_POINTS','MOVEMENT_SPEED',
  'LUCK','GOLD_FIND','EXPERIENCE_GAIN','LIFESTEAL','THORNS','CARRYING_CAPACITY',
  'WOODCUTTING_EFFICIENCY','MINING_EFFICIENCY','FISHING_EFFICIENCY','GATHERING_EFFICIENCY'
) NOT NULL;

ALTER TABLE `UserItemStat` MODIFY `statType` ENUM(
  'PHYSICAL_DAMAGE_MIN','PHYSICAL_DAMAGE_MAX','MAGIC_DAMAGE_MIN','MAGIC_DAMAGE_MAX',
  'CRITICAL_CHANCE','CRITICAL_DAMAGE','ATTACK_SPEED','ACCURACY','ARMOR','MAGIC_RESIST',
  'EVASION_MELEE','EVASION_RANGED','EVASION_MAGIC','BLOCK_CHANCE',
  'FIRE_RESIST','COLD_RESIST','LIGHTNING_RESIST','POISON_RESIST',
  'HEALTH','MANA','HEALTH_REGEN','MANA_REGEN','PRAYER_POINTS','MOVEMENT_SPEED',
  'LUCK','GOLD_FIND','EXPERIENCE_GAIN','LIFESTEAL','THORNS','CARRYING_CAPACITY',
  'WOODCUTTING_EFFICIENCY','MINING_EFFICIENCY','FISHING_EFFICIENCY','GATHERING_EFFICIENCY'
) NOT NULL;

ALTER TABLE `FoodEffectStat` MODIFY `statType` ENUM(
  'PHYSICAL_DAMAGE_MIN','PHYSICAL_DAMAGE_MAX','MAGIC_DAMAGE_MIN','MAGIC_DAMAGE_MAX',
  'CRITICAL_CHANCE','CRITICAL_DAMAGE','ATTACK_SPEED','ACCURACY','ARMOR','MAGIC_RESIST',
  'EVASION_MELEE','EVASION_RANGED','EVASION_MAGIC','BLOCK_CHANCE',
  'FIRE_RESIST','COLD_RESIST','LIGHTNING_RESIST','POISON_RESIST',
  'HEALTH','MANA','HEALTH_REGEN','MANA_REGEN','PRAYER_POINTS','MOVEMENT_SPEED',
  'LUCK','GOLD_FIND','EXPERIENCE_GAIN','LIFESTEAL','THORNS','CARRYING_CAPACITY',
  'WOODCUTTING_EFFICIENCY','MINING_EFFICIENCY','FISHING_EFFICIENCY','GATHERING_EFFICIENCY'
) NOT NULL;

-- ItemStatRarityOverride predates migrations in some installations. Expand its
-- enum when the table exists without making clean installs fail.
SET @db := DATABASE();
SET @stmt := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ItemStatRarityOverride'
    ),
    CONVERT(0x414c544552205441424c4520604974656d537461745261726974794f7665727269646560204d4f44494659206073746174547970656020454e554d2827504859534943414c5f44414d4147455f4d494e272c27504859534943414c5f44414d4147455f4d4158272c274d414749435f44414d4147455f4d494e272c274d414749435f44414d4147455f4d4158272c27435249544943414c5f4348414e4345272c27435249544943414c5f44414d414745272c2741545441434b5f5350454544272c274143435552414359272c2741524d4f52272c274d414749435f524553495354272c2745564153494f4e5f4d454c4545272c2745564153494f4e5f52414e474544272c2745564153494f4e5f4d41474943272c27424c4f434b5f4348414e4345272c27464952455f524553495354272c27434f4c445f524553495354272c274c494748544e494e475f524553495354272c27504f49534f4e5f524553495354272c274845414c5448272c274d414e41272c274845414c54485f524547454e272c274d414e415f524547454e272c275052415945525f504f494e5453272c274d4f56454d454e545f5350454544272c274c55434b272c27474f4c445f46494e44272c27455850455249454e43455f4741494e272c274c494645535445414c272c2754484f524e53272c274341525259494e475f4341504143495459272c27574f4f4443555454494e475f454646494349454e4359272c274d494e494e475f454646494349454e4359272c2746495348494e475f454646494349454e4359272c27474154484552494e475f454646494349454e43592729204e4f54204e554c4c USING utf8mb4),
    'SELECT 1'
  )
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

ALTER TABLE `Item`
  ADD COLUMN `seedXp` INTEGER NULL;

-- Existing seeds predate Gardening XP. Give them a conservative one-time
-- backfill based on their configured grow time; administrators can tune it
-- afterward and planted tiles snapshot the chosen value.
UPDATE `Item`
SET `seedXp` = GREATEST(1, ROUND(COALESCE(`seedGrowSeconds`, 1200) / 1200))
WHERE `itemType` = 'SEED' AND `seedXp` IS NULL;

ALTER TABLE `UserGardenTile`
  ADD COLUMN `xpReward` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `Location`
  ADD COLUMN `gatheringEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `gatheringRequiredLevel` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `LocationVocationalResource`
  ADD COLUMN `gatheringBaseChance` DOUBLE NOT NULL DEFAULT 0.25,
  ADD COLUMN `gatheringMinQuantity` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `gatheringMaxQuantity` INTEGER NOT NULL DEFAULT 1;

CREATE TABLE `GatheringDuration` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `label` VARCHAR(191) NOT NULL,
  `durationSeconds` INTEGER NOT NULL,
  `rewardRolls` INTEGER NOT NULL DEFAULT 3,
  `quantityMultiplier` DOUBLE NOT NULL DEFAULT 1,
  `xpReward` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `GatheringDuration_label_key`(`label`),
  UNIQUE INDEX `GatheringDuration_durationSeconds_key`(`durationSeconds`),
  INDEX `GatheringDuration_enabled_sortOrder_idx`(`enabled`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserGatheringExpedition` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` VARCHAR(191) NOT NULL,
  `locationId` INTEGER NOT NULL,
  `durationId` INTEGER NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endsAt` DATETIME(3) NOT NULL,
  `claimedAt` DATETIME(3) NULL,
  `durationSeconds` INTEGER NOT NULL,
  `rewardRolls` INTEGER NOT NULL,
  `quantityMultiplier` DOUBLE NOT NULL,
  `xpReward` INTEGER NOT NULL,
  `skillLevelSnapshot` INTEGER NOT NULL,
  `luckSnapshot` DOUBLE NOT NULL,
  `gatheringEfficiencySnapshot` DOUBLE NOT NULL,
  `rewardPool` JSON NOT NULL,
  `rewards` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `UserGatheringExpedition_userId_key`(`userId`),
  INDEX `UserGatheringExpedition_endsAt_idx`(`endsAt`),
  INDEX `UserGatheringExpedition_locationId_idx`(`locationId`),
  INDEX `UserGatheringExpedition_durationId_idx`(`durationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserGatheringExpedition`
  ADD CONSTRAINT `UserGatheringExpedition_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UserGatheringExpedition`
  ADD CONSTRAINT `UserGatheringExpedition_locationId_fkey`
  FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `UserGatheringExpedition`
  ADD CONSTRAINT `UserGatheringExpedition_durationId_fkey`
  FOREIGN KEY (`durationId`) REFERENCES `GatheringDuration`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve legacy garden progression under the new Gardening identity. The old
-- Gathering records are reset only after their values have been copied.
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

-- Some older characters only have progression in user_skills. Seed the modern
-- canonical track from that copy as well, including the cumulative XP at the
-- start of the stored level when threshold data is available.
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
