-- Creatures get magic damage alongside physical and elemental damage. Hunting
-- retaliation now uses the full attack profile, so hunts also snapshot the
-- character's elemental resistances (older hunts resolve with 0).

-- AlterTable
ALTER TABLE `Creature` ADD COLUMN `magicDamageMax` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `magicDamageMin` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `UserHuntingExpedition` ADD COLUMN `coldResistSnapshot` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `fireResistSnapshot` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `lightningResistSnapshot` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `poisonResistSnapshot` DOUBLE NOT NULL DEFAULT 0;

