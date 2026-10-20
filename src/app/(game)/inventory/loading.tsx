import EquipmentSkeleton from "~/components/game/character/Equipment/EquipmentSkeleton";
import { Skeleton } from "~/components/ui/skeleton";

const INVENTORY_SLOT_COUNT = 18;

function InventorySkeleton() {
  return (
    <section
      className="game-panel min-w-0 border-0"
      aria-label="Loading inventory"
    >
      <div className="game-panel-header">
        <h2 className="game-section-title">Inventory</h2>
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="game-panel-body">
        <div className="game-inventory-grid" aria-hidden="true">
          {Array.from({ length: INVENTORY_SLOT_COUNT }).map((_, index) => (
            <Skeleton className="game-slot" key={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PanelSkeleton({
  rows,
  className,
}: {
  rows: number;
  className: string;
}) {
  return (
    <section
      className={`game-panel-flat min-w-0 p-4 sm:p-6 ${className}`}
      aria-hidden="true"
    >
      <Skeleton className="h-5 w-28" />
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton className="h-11 rounded-xl" key={index} />
        ))}
      </div>
    </section>
  );
}

export default function InventoryLoading() {
  return (
    <main aria-busy="true" aria-label="Loading inventory">
      <div className="game-page-heading" aria-hidden="true">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-40" />
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(420px,540px)_minmax(508px,1fr)]">
        <div className="min-w-0">
          <EquipmentSkeleton />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <InventorySkeleton />
          <PanelSkeleton rows={12} className="" />
        </div>
      </div>
    </main>
  );
}
