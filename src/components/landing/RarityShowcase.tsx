"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ItemRarity } from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import { RARITY_VISUALS, rarityStyle } from "~/utils/rarity-colors";
import { ItemRarityMark, RarityMark } from "~/utils/ui/rarity-mark";
import { Button } from "~/components/ui/button";
import { Tilt, useReveal } from "./motion";

const TIERS = Object.keys(RARITY_VISUALS) as ItemRarity[];
const LAST = TIERS.length - 1;
const STEP_MS = 170;
// Each tier is this much rarer than the one below it. For show: the real
// odds depend on what dropped the item.
const RARER = 0.62;

function rollTier() {
  let tier = 0;
  while (tier < LAST && Math.random() < RARER) tier++;
  return tier;
}

function tierName(rarity: ItemRarity) {
  return rarity.charAt(0) + rarity.slice(1).toLowerCase();
}

export function RarityShowcase() {
  const [ref, reveal] = useReveal<HTMLDivElement>(0.45);
  const [index, setIndex] = useState(LAST);
  const [touched, setTouched] = useState(false);
  const [rolls, setRolls] = useState(0);
  const [best, setBest] = useState(-1);

  const roll = () => {
    const tier = rollTier();
    setTouched(true);
    setIndex(tier);
    setRolls((count) => count + 1);
    setBest((current) => Math.max(current, tier));
  };

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
      {/* Rays behind the frame, brighter the rarer the tier. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[104px] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 [mask-image:radial-gradient(circle,#000_18%,transparent_66%)] sm:top-[120px]"
        style={{ opacity: 0.08 + (index / LAST) * 0.5 }}
      >
        <div
          className="h-full w-full transition-[background] duration-300 motion-safe:animate-[spin_50s_linear_infinite]"
          style={{
            background: `repeating-conic-gradient(${color} 0deg 5deg, transparent 5deg 20deg)`,
          }}
        />
      </div>
      <Tilt max={12}>
        <div
          // A new key replays the pop each time a roll lands.
          key={rolls}
          className={cn(
            "rarity-frame relative h-44 w-44 rounded-[22px] p-4 transition-[border-color,box-shadow,background] duration-300 sm:h-52 sm:w-52",
            rolls > 0 && "motion-safe:animate-drop-pop",
          )}
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
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_var(--gx,30%)_var(--gy,0%),rgba(255,255,255,0.2),transparent_55%)]"
          />
        </div>
      </Tilt>

      <p
        className="relative mt-6 text-2xl font-semibold tracking-[-0.03em] transition-colors duration-300"
        style={{ color: "var(--rarity-text)", ...rarityStyle(rarity) }}
      >
        Ogre Cleaver
      </p>
      <p
        className="relative mt-1 flex items-center gap-1.5 text-sm font-medium transition-colors duration-300"
        style={{ color }}
        // Silent during the opening climb; announces only tiers the visitor picks.
        aria-live={touched ? "polite" : "off"}
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

      <Button variant="soft" className="relative mt-8 px-6" onClick={roll}>
        {rolls === 0 ? "Roll a drop" : "Roll again"}
      </Button>
      <p className="relative mt-3 min-h-5 text-sm text-muted-foreground">
        {rolls === 0 ? (
          "Try your luck. Most drops are honest work."
        ) : (
          <>
            {rolls} {rolls === 1 ? "roll" : "rolls"} · best so far{" "}
            <span
              className="font-semibold"
              style={{ color: RARITY_VISUALS[TIERS[best]!].color }}
            >
              {tierName(TIERS[best]!)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
