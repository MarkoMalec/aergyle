/*
  Warnings:

  - A unique constraint covering the columns `[inventoryId,slotIndex]` on the table `InventorySlot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `InventorySlot_inventoryId_slotIndex_key` ON `InventorySlot`(`inventoryId`, `slotIndex`);
