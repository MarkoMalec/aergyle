-- Character base stats now scale with level. Rules are resolved live from each
-- character's level; stats without a row use the code defaults.

-- CreateTable
CREATE TABLE `CharacterStatGrowth` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `statType` ENUM('PHYSICAL_DAMAGE_MIN', 'PHYSICAL_DAMAGE_MAX', 'MAGIC_DAMAGE_MIN', 'MAGIC_DAMAGE_MAX', 'CRITICAL_CHANCE', 'CRITICAL_DAMAGE', 'ATTACK_SPEED', 'ACCURACY', 'ARMOR', 'MAGIC_RESIST', 'EVASION_MELEE', 'EVASION_RANGED', 'EVASION_MAGIC', 'BLOCK_CHANCE', 'FIRE_RESIST', 'COLD_RESIST', 'LIGHTNING_RESIST', 'POISON_RESIST', 'HEALTH', 'MANA', 'HEALTH_REGEN', 'MANA_REGEN', 'PRAYER_POINTS', 'MOVEMENT_SPEED', 'LUCK', 'GOLD_FIND', 'EXPERIENCE_GAIN', 'LIFESTEAL', 'THORNS', 'CARRYING_CAPACITY', 'WOODCUTTING_EFFICIENCY', 'MINING_EFFICIENCY', 'FISHING_EFFICIENCY', 'GATHERING_EFFICIENCY', 'HUNTING_EFFICIENCY') NOT NULL,
    `baseValue` DOUBLE NOT NULL,
    `perLevel` DOUBLE NOT NULL DEFAULT 0,
    `maxBonus` DOUBLE NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CharacterStatGrowth_statType_key`(`statType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CharacterBaseStat rows used to replace the defaults and could only hold
-- materialized copies of them. They now mean per-character additions on top of
-- the level-scaled values, so old copies would double-count.
DELETE FROM `CharacterBaseStat`;
