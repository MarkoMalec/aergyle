import EquipmentSkeleton from "~/components/game/character/Equipment/EquipmentSkeleton";
import { Skeleton } from "~/components/ui/skeleton";

const CORE_STAT_COUNT = 6;
const INVENTORY_SLOT_COUNT = 18;

function CharacterHeroSkeleton() {
  return (
    <section
      className="game-panel game-character-hero"
      aria-label="Loading character"
    >
      <Skeleton className="game-character-hero-art rounded-[45%_45%_18%_18%] bg-primary/[0.07]" />
      <div className="game-character-hero-identity">
        <Skeleton className="h-[58px] w-[118px] rounded-xl" />
        <div className="game-character-hero-caption">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-6 w-32" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      </div>
      <div className="game-character-hero-stats">
        <div className="game-core-stats" aria-hidden="true">
          {Array.from({ length: CORE_STAT_COUNT }).map((_, index) => (
            <div className="game-core-stat" key={index}>
              <Skeleton className="h-[30px] w-[30px] rounded-lg" />
              <div className="min-w-0">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="mt-2 h-4 w-14" />
              </div>
            </div>
          ))}
        </div>
        <div className="game-attributes-actions">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      </div>
    </section>
  );
}

function InventorySkeleton() {
  return (
    <section
      className="game-panel game-inventory-panel min-w-0"
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

export default function ProfileLoading() {
  return (
    <main aria-busy="true" aria-label="Loading character profile">
      <div className="game-page-heading">
        <div className="w-full">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-10 w-48" />
          <Skeleton className="mt-3 h-4 w-full max-w-[520px]" />
        </div>
      </div>

      <CharacterHeroSkeleton />
      <div className="game-profile-dashboard">
        <EquipmentSkeleton />
        <InventorySkeleton />
      </div>
    </main>
  );
}
