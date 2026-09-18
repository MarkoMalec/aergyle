"use client";

import { useState } from "react";
import { DroppableSlot } from "../../../dnd/DroppableSlot";
import { useDndContext } from "~/components/dnd/DnDContext";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";

const Inventory = () => {
  const { inventory, deleteSlot } = useDndContext();
  const [showAll, setShowAll] = useState(false);
  const occupiedCount = inventory.filter((slot) => slot.item).length;
  const lastOccupiedIndex = inventory.reduce(
    (last, slot, index) => (slot.item ? index : last),
    -1,
  );
  // Hide only trailing empty slots. Existing positions and drag/drop indices stay intact.
  const compactCount = Math.min(
    inventory.length,
    Math.max(18, lastOccupiedIndex + 7),
  );
  const visibleSlots = showAll ? inventory : inventory.slice(0, compactCount);

  return (
    <section
      id="inventory"
      className="game-panel game-inventory-panel min-w-0 scroll-mt-24"
      aria-labelledby="inventory-heading"
    >
      <div className="game-panel-header">
        <h2 id="inventory-heading" className="game-section-title">
          Inventory
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {occupiedCount} / {inventory.length} slots
        </span>
      </div>
      <div className="game-panel-body">
        <div id="inventory-slots" className="game-inventory-grid">
          {visibleSlots.map((slot, index) => (
            <DroppableSlot
              key={index}
              id={`inventory-${index}`}
              index={index}
              slot={slot}
              container="inventory"
            />
          ))}
        </div>
        {compactCount < inventory.length && (
          <Button
            variant="ghost"
            className="mt-4 w-full text-muted-foreground"
            aria-expanded={showAll}
            aria-controls="inventory-slots"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showAll
              ? "Show fewer empty slots"
              : `Show all ${inventory.length} slots`}
          </Button>
        )}
        <details className="mt-4 border-t border-border pt-4">
          <summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-xs text-muted-foreground hover:text-foreground">
            <Trash2 size={14} />
            Discard items{deleteSlot.item ? ` · ${deleteSlot.item.name}` : ""}
            <ChevronDown size={14} />
          </summary>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              <DroppableSlot
                id="delete-slot"
                index={999}
                slot={deleteSlot}
                container="delete"
              />
              {!deleteSlot.item && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <Trash2 className="h-5 w-5 text-danger/70" />
                </div>
              )}
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Drop an item here to discard it. You can drag it back until
              another item replaces it; the replaced item is permanently
              deleted.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
};

export default Inventory;
