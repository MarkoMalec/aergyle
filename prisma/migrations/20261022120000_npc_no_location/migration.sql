-- NPCs may have no location (settlementId NULL); such NPCs are hidden from
-- players. Deleting a settlement now leaves its NPCs without a location
-- instead of deleting them. Existing rows keep their settlement.

-- DropForeignKey
ALTER TABLE `Npc` DROP FOREIGN KEY `Npc_settlementId_fkey`;

-- AlterTable
ALTER TABLE `Npc` MODIFY `settlementId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Npc` ADD CONSTRAINT `Npc_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
