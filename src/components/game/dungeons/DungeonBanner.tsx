import { Castle } from "lucide-react";
import {
  JournalButton,
  LocationChip,
} from "~/components/game/expeditions/parts";
import type { JournalEntry } from "./types";

/**
 * The dungeons page header. Its artwork is
 * public/assets/skills/dungeons-header.webp (wide, ~2400×640, focal point
 * centre-right); until that file exists the banner shows its own backdrop.
 */
export function DungeonBanner(props: {
  locationName: string | null;
  journalCount: number;
  lastRun: JournalEntry | null;
  onOpenJournal: (() => void) | null;
}) {
  const lastCleared = props.lastRun?.report.outcome === "CLEARED";

  return (
    <header className="relative isolate overflow-hidden rounded-lg bg-surface-inset shadow-[var(--shadow-panel)]">
      {/* Backdrop while no artwork is in place */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-30 bg-[radial-gradient(55%_110%_at_80%_75%,hsl(var(--danger)/0.26),transparent_65%),radial-gradient(40%_80%_at_96%_5%,hsl(var(--primary)/0.16),transparent_70%)]"
      />
      <Castle
        aria-hidden="true"
        strokeWidth={0.75}
        className="absolute -bottom-8 right-4 -z-30 h-72 w-72 text-foreground/[0.06] sm:right-20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[url('/assets/skills/dungeons-header.webp')] bg-cover bg-[position:65%_center]"
      />
      {/* Scrims keep the copy readable over any artwork */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-background/95 via-background/40 to-background/0"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-background/75 via-background/15 to-transparent"
      />

      <div className="flex min-h-[230px] flex-col justify-between gap-10 p-5 sm:min-h-[280px] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {props.locationName ? (
            <LocationChip
              name={props.locationName}
              className="bg-background/75"
            />
          ) : (
            <span />
          )}
          <JournalButton
            count={props.journalCount}
            last={
              props.lastRun
                ? {
                    good: lastCleared,
                    label: `${lastCleared ? "Cleared" : "Fell in"} ${props.lastRun.dungeon.name}`,
                  }
                : null
            }
            onClick={props.onOpenJournal}
            className="bg-background/75 hover:bg-background/95"
          />
        </div>

        <div className="max-w-xl [text-shadow:0_1px_3px_hsl(var(--background)/0.9)]">
          <p className="game-eyebrow">Danger below</p>
          <h1 className="game-page-title">Dungeons</h1>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-text-secondary">
            Fight through with your current health and gear. Clear it for
            experience and whatever its monsters carried; fall, and you crawl
            out with scraps.
          </p>
        </div>
      </div>
    </header>
  );
}
