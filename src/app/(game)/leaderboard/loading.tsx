import { Skeleton } from "~/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="min-w-0 space-y-4" aria-busy="true" aria-label="Loading leaderboard">
      <div className="game-page-heading" aria-hidden="true">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-40" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {[36, 32, 24].map((width) => (
          <Skeleton key={width} className="h-9 rounded-[9px]" style={{ width: `${width * 4}px` }} />
        ))}
      </div>
      <div className="game-panel-flat space-y-1 p-2" aria-hidden="true">
        {Array.from({ length: 11 }).map((_, index) => (
          <Skeleton key={index} className="h-11 rounded-[8px]" />
        ))}
      </div>
    </div>
  );
}
