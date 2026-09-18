"use client";

import Image from "next/image";
import { Clock3 } from "lucide-react";
import { useActiveFoodEffect } from "~/hooks/use-active-food-effect";
import { formatDuration } from "~/components/game/actions/format";
import { formatStatValue } from "~/utils/stats";
import { STAT_METADATA } from "~/types/stats";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export type HeaderEffect = {
  name: string;
  sprite: string;
  remainingSeconds: number;
  modifiers: Array<{ label: string; value: string }>;
};

export function EffectHeaderIndicator({ effect }: { effect: HeaderEffect }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="group flex h-12 min-w-0 items-center gap-2.5 rounded-xl bg-card/70 py-1.5 pl-1.5 pr-3 shadow-[var(--shadow-panel)] transition-colors duration-150 hover:bg-secondary/70"
            aria-label={`${effect.name} active effect, ${formatDuration(effect.remainingSeconds)} remaining`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent/70">
              <Image
                src={effect.sprite}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain transition-transform duration-150 group-hover:scale-105"
              />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-32 truncate text-xs font-semibold text-foreground">
                {effect.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success)/0.55)]"
                  aria-hidden="true"
                />
                <Clock3 size={10} aria-hidden="true" />
                {formatDuration(effect.remainingSeconds)}
              </span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-72 space-y-1 rounded-xl border-0"
        >
          <div className="font-semibold">{effect.name}</div>
          {effect.modifiers.map((modifier) => (
            <div key={modifier.label} className="flex justify-between gap-4">
              <span>{modifier.label}</span>
              <span>{modifier.value}</span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ActiveEffectHeaderWidget() {
  // Food is the first active-effect source. Other timed effects can be
  // normalized into HeaderEffect and rendered by the same indicator.
  const { effect: foodEffect, remainingSeconds } = useActiveFoodEffect();
  if (!foodEffect) return null;

  const effect: HeaderEffect = {
    name: foodEffect.item.name,
    sprite: foodEffect.item.sprite,
    remainingSeconds,
    modifiers: foodEffect.item.foodEffectStats.map((stat) => ({
      label: STAT_METADATA[stat.statType].label,
      value: formatStatValue(stat.value, stat.statType),
    })),
  };

  return <EffectHeaderIndicator effect={effect} />;
}
