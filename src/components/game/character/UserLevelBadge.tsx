"use client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useLevelContext } from "~/context/levelContext";

/** The level number inside a ring that fills with progress to the next level. */
function LevelRing({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke="hsl(var(--xp))"
          strokeWidth="2"
          strokeDasharray={113.1}
          strokeDashoffset={113.1 * (1 - progress / 100)}
        />
      </svg>
      <span className="text-lg font-bold text-primary">{label}</span>
    </div>
  );
}

export const UserLevelBadge = ({ className }: { className?: string }) => {
  const { levelData, isLoading } = useLevelContext();
  const progress = levelData
    ? Math.max(0, Math.min(100, levelData.xpProgress))
    : 0;
  const label = isLoading ? "…" : String(levelData?.level ?? "—");
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger className={cn(className)}>
          <div className="flex items-center gap-3 p-2">
            <LevelRing progress={progress} label={label} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div
            className="flex items-center gap-3 p-2"
            aria-label={
              levelData
                ? `Level ${levelData.level}, ${Math.floor(progress)} percent to next level`
                : "Loading level"
            }
          >
            <LevelRing progress={progress} label={label} />
            <div>
              <span className="game-eyebrow">Level</span>
              <span className="block text-[10px] text-muted-foreground">
                {Math.floor(progress)}% to next
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
