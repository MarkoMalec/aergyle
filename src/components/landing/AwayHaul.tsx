"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { rarityStyle } from "~/utils/rarity-colors";
import { AWAY_SHIFT } from "./content";
import { useReveal } from "./motion";

const COUNT_MS = 2200;

/** The game's "While you were away" summary for one mining run. */
export function AwayHaul() {
  const [ref, reveal] = useReveal<HTMLDivElement>(0.4);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (reveal === "pending") setProgress(0);
    if (reveal !== "shown") return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reveal]);

  const ore = Math.round(AWAY_SHIFT.ore * progress);
  const xp = Math.round(AWAY_SHIFT.xp * progress);

  return (
    <div
      ref={ref}
      className="w-full max-w-[400px] rounded-2xl bg-popover p-5 shadow-[0_30px_80px_-20px_#03080b]"
    >
      <p className="font-display text-xl font-semibold tracking-[-0.02em]">
        While you were away
      </p>
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
            <p className="truncate text-sm font-semibold">Mining · Copper Ore</p>
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
            <span className="game-item-quantity">{ore.toLocaleString("en-US")}</span>
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
