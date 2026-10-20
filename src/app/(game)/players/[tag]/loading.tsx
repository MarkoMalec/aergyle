import EquipmentSkeleton from "~/components/game/character/Equipment/EquipmentSkeleton";
import { Skeleton } from "~/components/ui/skeleton";

const HEADLINE_STAT_COUNT = 6;

function CharacterHeroSkeleton() {
  return (
    <section
      className="mb-5 grid grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-lg bg-card shadow-[var(--shadow-panel)] [grid-template-areas:'art_id'_'meters_meters'_'stats_stats'] sm:grid-cols-[176px_minmax(0,1fr)] sm:[grid-template-areas:'art_id'_'art_meters'_'stats_stats'] xl:grid-cols-[208px_minmax(0,1fr)_minmax(300px,372px)] xl:[grid-template-areas:'art_id_stats'_'art_meters_stats']"
      aria-label="Loading character"
    >
      <div className="relative min-h-[168px] [grid-area:art] sm:min-h-[236px]">
        <Skeleton className="absolute inset-x-4 bottom-0 top-6 rounded-[45%_45%_12px_12px] bg-primary/[0.07]" />
      </div>
      <div className="min-w-0 self-center py-5 pr-4 [grid-area:id] sm:self-end sm:pb-0 sm:pr-6 sm:pt-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-48 max-w-full" />
        <Skeleton className="mt-2 h-3 w-36 max-w-full" />
      </div>
      <div className="flex min-w-0 flex-col gap-4 px-4 pb-5 [grid-area:meters] sm:self-start sm:pl-0 sm:pr-6 sm:pt-4 xl:pb-6">
        {[0, 1].map((index) => (
          <div className="flex items-center gap-3" key={index}>
            <Skeleton className="h-[54px] w-[54px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-[7px] w-full" />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 bg-background/20 p-3 [grid-area:stats] sm:grid-cols-3 sm:p-4 xl:grid-cols-2 xl:self-center xl:bg-transparent xl:py-6 xl:pl-4 xl:pr-6">
        {Array.from({ length: HEADLINE_STAT_COUNT }).map((_, index) => (
          <Skeleton className="h-[52px] rounded-xl" key={index} />
        ))}
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

export default function PlayerProfileLoading() {
  return (
    <main aria-busy="true" aria-label="Loading profile">
      <CharacterHeroSkeleton />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(420px,540px)_minmax(508px,1fr)]">
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <div className="order-3 min-w-0">
            <EquipmentSkeleton />
          </div>
          <PanelSkeleton rows={8} className="order-5" />
        </div>
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <PanelSkeleton rows={3} className="order-1" />
          <PanelSkeleton rows={4} className="order-2" />
          <PanelSkeleton rows={12} className="order-4" />
        </div>
      </div>
    </main>
  );
}
