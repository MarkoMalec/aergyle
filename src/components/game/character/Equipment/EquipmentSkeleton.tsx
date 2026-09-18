import { Skeleton } from "~/components/ui/skeleton";
import { EquipmentLayout } from "./EquipmentLayout";

export default function EquipmentSkeleton() {
  return (
    <section
      className="game-panel game-equipment-panel min-w-0"
      aria-label="Equipment"
      aria-busy="true"
    >
      <div className="game-panel-header">
        <div>
          <p className="game-eyebrow">Loadout</p>
          <h2 className="game-section-title">Equipment</h2>
        </div>
        <span className="text-xs text-muted-foreground" role="status">
          Loading gear…
        </span>
      </div>
      <div className="game-panel-body game-equipment-content">
        <div aria-hidden="true">
          <EquipmentLayout
            renderSlot={() => <Skeleton className="game-slot" />}
          />
        </div>
        <p className="game-equipment-hint">
          Drag gear onto a matching slot. Paired armor equips both sides.
        </p>
      </div>
    </section>
  );
}
