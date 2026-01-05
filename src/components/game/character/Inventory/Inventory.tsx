"use client";

import React from "react";
import { DroppableSlot } from "../../../dnd/DroppableSlot";
import { useDndContext } from "~/components/dnd/DnDContext";
import { Info, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "~/components/ui/tooltip";

const Inventory = () => {
  const { inventory, deleteSlot } = useDndContext();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {inventory.map((slot, index) => (
          <DroppableSlot
            key={index}
            id={`inventory-${index}`}
            index={index}
            slot={slot}
            container="inventory"
          />
        ))}
      </div>

      {/* Delete Slot */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative">
          <DroppableSlot
            id="delete-slot"
            index={999}
            slot={deleteSlot}
            container="delete"
          />
          {!deleteSlot.item && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Trash2 className="h-6 w-6 text-red-400/50" />
            </div>
          )}
        </div>
        {deleteSlot.item && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="ml-2 inline-block h-6 w-6 text-yellow-300" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Drop another item here to delete <i className="underline">{deleteSlot.item.name}</i>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};

export default Inventory;
