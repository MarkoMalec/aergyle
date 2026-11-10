"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { rarityStyle } from "~/utils/rarity-colors";
import { cn } from "~/lib/utils";
import { AWAY_SHIFT } from "./content";
import { useReveal } from "./motion";

const COUNT_MS = 2200;
// Hours away; the last is the full run AWAY_SHIFT describes.
const SHIFTS = [1, 2, 4] as const;

/** The game's "While you were away" summary for one mining run. */
export function AwayHaul() {
  const [ref, reveal] = useReveal<HTMLDivElement>(0.4);
  const [progress, setProgress] = useState(1);
  const [hours, setHours] = useState<number>(4);
  // Counts again from zero each time another shift is picked.
  const [recount, setRecount] = useState(0);

  useEffect(() => {
    if (reveal === "pending") setProgress(0);
    if (reveal !== "shown" && recount === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reveal, recount]);

  const share = (hours / 4) * progress;
  const ore = Math.round(AWAY_SHIFT.ore * share);
  // Counted from the ore, so the two never disagree by a rounding.
  const xp = ore * (AWAY_SHIFT.xp / AWAY_SHIFT.ore);

  return (
    <div
      ref={ref}
      className="w-full max-w-[400px] rounded-2xl bg-popover p-5 shadow-[0_30px_80px_-20px_#03080b]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-semibold tracking-[-0.02em]">
          While you were away
        </p>
        <div
          className="flex gap-1 rounded-lg bg-surface-inset/70 p-1"
          role="group"
          aria-label="Time away"
        >
          {SHIFTS.map((shift) => (
            <button
              key={shift}
              type="button"
              aria-pressed={shift === hours}
              aria-label={`${shift} ${shift === 1 ? "hour" : "hours"}`}
              onClick={() => {
                setHours(shift);
                setRecount((count) => count + 1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                shift === hours
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {shift} h
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 rounded-xl bg-surface-inset/70 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/30">
            <Image
              src="/assets/skills/icons/mining.webp"
              alt=""
              width={28}
              height={28}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              Mining · Copper Ore
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Citadel · Run complete
            </p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-background/80">
          <div
            className="h-full rounded-full bg-xp"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-4">
          <div
            className="rarity-frame relative h-[68px] w-[68px] shrink-0 rounded-xl p-1"
            data-rarity="COMMON"
            style={rarityStyle("COMMON")}
          >
            <Image
              src="/assets/items/resources/ores/copper-ore-atlas-v1.png"
              alt="Copper Ore"
              width={68}
              height={68}
              className="h-full w-full object-contain"
            />
            <span className="game-item-quantity">
              {ore.toLocaleString("en-US")}
            </span>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums text-xp">
              +{xp.toLocaleString("en-US")} XP
            </p>
            <p className="text-xs text-muted-foreground">Mining</p>
          </div>
        </div>
      </div>
      <Button asChild variant="soft" className="mt-4 w-full">
        <Link href="/play?mode=register">Claim your first haul</Link>
      </Button>
    </div>
  );
}
