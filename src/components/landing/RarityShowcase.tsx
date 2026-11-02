"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ItemRarity } from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import { RARITY_VISUALS, rarityStyle } from "~/utils/rarity-colors";
import { ItemRarityMark, RarityMark } from "~/utils/ui/rarity-mark";
import { useReveal } from "./motion";

const TIERS = Object.keys(RARITY_VISUALS) as ItemRarity[];
const LAST = TIERS.length - 1;
const STEP_MS = 170;

function tierName(rarity: ItemRarity) {
  return rarity.charAt(0) + rarity.slice(1).toLowerCase();
}

export function RarityShowcase() {
  const [ref, reveal] = useReveal<HTMLDivElement>(0.45);
  const [index, setIndex] = useState(LAST);
  const [touched, setTouched] = useState(false);

  // Below the fold the blade starts Worthless and climbs once to Divine when
  // it comes into view, then stays put. Picking a tier stops the climb.
  useEffect(() => {
    if (reveal === "pending" && !touched) setIndex(0);
    if (reveal !== "shown" || touched) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= LAST) {
          window.clearInterval(timer);
          return LAST;
        }
        return current + 1;
      });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [reveal, touched]);

  const rarity = TIERS[index] ?? "DIVINE";
  const color = RARITY_VISUALS[rarity].color;

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color] duration-300"
        style={{
          background: `radial-gradient(circle, ${color}2e 0%, ${color}10 38%, transparent 68%)`,
        }}
      />
      <div
        className="rarity-frame relative h-44 w-44 rounded-[22px] p-4 transition-[border-color,box-shadow,background] duration-300 sm:h-52 sm:w-52"
        data-rarity={rarity}
        style={rarityStyle(rarity)}
      >
        <Image
          src="/assets/items/weapons/ogre-cleaver-atlas-v1.png"
          alt={`Ogre Cleaver, ${tierName(rarity).toLowerCase()}`}
          width={256}
          height={256}
          className="h-full w-full object-contain"
        />
        <ItemRarityMark rarity={rarity} />
      </div>

      <p
        className="relative mt-6 font-display text-2xl font-semibold tracking-[-0.03em] transition-colors duration-300"
        style={{ color: "var(--rarity-text)", ...rarityStyle(rarity) }}
      >
        Ogre Cleaver
      </p>
      <p
        className="relative mt-1 flex items-center gap-1.5 text-sm font-medium transition-colors duration-300"
        style={{ color }}
        aria-live="polite"
      >
        <RarityMark rarity={rarity} className="h-4 w-4" />
        {tierName(rarity)}
      </p>

      <div
        className="relative mt-8 flex w-full max-w-md items-end gap-1"
        role="group"
        aria-label="Rarity tiers"
      >
        {TIERS.map((tier, position) => {
          const active = position === index;
          return (
            <button
              key={tier}
              type="button"
              aria-pressed={active}
              aria-label={tierName(tier)}
              title={tierName(tier)}
              onClick={() => {
                setTouched(true);
                setIndex(position);
              }}
              className="group flex h-7 flex-1 items-end rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "block w-full rounded-full transition-[height,opacity] duration-200",
                  active
                    ? "h-4 opacity-100"
                    : position < index
                      ? "h-2 opacity-90 group-hover:h-3"
                      : "h-2 opacity-35 group-hover:h-3 group-hover:opacity-70",
                )}
                style={{ backgroundColor: RARITY_VISUALS[tier].color }}
              />
            </button>
          );
        })}
      </div>
      <div className="relative mt-2 flex w-full max-w-md justify-between text-xs text-muted-foreground">
        <span>Worthless</span>
        <span>Divine</span>
      </div>
    </div>
  );
}
