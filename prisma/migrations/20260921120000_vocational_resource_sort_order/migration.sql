-- Admin-managed display order for vocational resources, applied per action type.
-- Existing rows keep the order players see today (id ascending within the skill),
-- spaced by 10 so a single row can be slotted in without renumbering the rest.

-- AlterTable
ALTER TABLE `VocationalResource` ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0;

UPDATE `VocationalResource` AS `resource`
JOIN (
    SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `actionType` ORDER BY `id`) * 10 AS `position`
    FROM `VocationalResource`
) AS `ranked` ON `ranked`.`id` = `resource`.`id`
SET `resource`.`sortOrder` = `ranked`.`position`;

-- The new composite index covers the actionType-only lookups the old index served.
-- DropIndex
DROP INDEX `VocationalResource_actionType_idx` ON `VocationalResource`;

-- CreateIndex
CREATE INDEX `VocationalResource_actionType_sortOrder_idx` ON `VocationalResource`(`actionType`, `sortOrder`);
