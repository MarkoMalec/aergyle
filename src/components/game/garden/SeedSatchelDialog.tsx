"use client";

import Image from "next/image";
import { Clock3, PackageOpen, Sparkles, Sprout, Sunrise } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { cn } from "~/lib/utils";
import {
  cropNameOf,
  formatCompactDuration,
  readyClockParts,
  type SeedConfigResponse,
  type SeedOption,
} from "./shared";

export const SATCHEL_ART = "/assets/garden/seed-satchel-v1.png";

function SeedFact(props: { icon: LucideIcon; label: string; value: string }) {
  const Icon = props.icon;
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        {props.label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">
        {props.value}
      </dd>
    </div>
  );
}

export function SeedSatchelDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seeds: SeedOption[];
  configs: Map<number, SeedConfigResponse>;
  /** Empty plots a plant from here goes into (the selection, or every empty plot). */
  targetCount: number;
  fromSelection: boolean;
  /** Why nothing can be planted right now, if so. */
  blockedReason: string | null;
  lastSeedId: number | null;
  now: number;
  pending: boolean;
  onPlant: (seed: SeedOption, count: number) => void;
}) {
  const growSeconds = (seed: SeedOption) =>
    props.configs.get(seed.templateItemId)?.seedGrowSeconds ?? null;
  // Quickest crop first, so the "ready at" column reads like a timeline.
  const seeds = [...props.seeds].sort(
    (a, b) =>
      (growSeconds(a) ?? Infinity) - (growSeconds(b) ?? Infinity) ||
      a.name.localeCompare(b.name),
  );

  const plots = `plot${props.targetCount === 1 ? "" : "s"}`;
  const description =
    props.blockedReason ??
    (props.targetCount === 0
      ? "No empty plots"
      : props.fromSelection
        ? `${props.targetCount} selected ${plots}`
        : `${props.targetCount} empty ${plots}`);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 border-0 p-0">
        <DialogHeader className="flex-row items-center gap-4 space-y-0 px-5 pb-4 pt-6 sm:px-6">
          <Image
            src={SATCHEL_ART}
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_6px_10px_hsl(var(--background)/0.5)]"
          />
          <div className="min-w-0 pr-8">
            <p className="game-eyebrow">Seed satchel</p>
            <DialogTitle>Choose what to plant</DialogTitle>
            <DialogDescription className="mt-1">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-2 px-3 pb-5 sm:px-6 sm:pb-6">
          {seeds.length === 0 ? (
            <div className="rounded-[12px] bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              <Sprout className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
              Your seed satchel is empty
            </div>
          ) : (
            seeds.map((seed) => {
              const config = props.configs.get(seed.templateItemId);
              const cropName = cropNameOf(seed, config);
              const grow = config?.seedGrowSeconds ?? null;
              const yieldMin = config?.seedYieldMin ?? null;
              const yieldMax = config?.seedYieldMax ?? null;
              const xp = config?.seedXp ?? 1;
              const count = Math.min(seed.quantity, props.targetCount);
              const isLast = seed.templateItemId === props.lastSeedId;
              const ready = grow
                ? readyClockParts(props.now + grow * 1000, props.now)
                : null;
              const canPlant =
                !props.blockedReason && count > 0 && !props.pending;
              return (
                <div
                  key={seed.templateItemId}
                  className={cn(
                    "flex flex-col gap-3 rounded-[12px] p-3 sm:flex-row sm:items-center",
                    isLast ? "bg-primary/[0.07]" : "bg-card",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <ItemArtwork
                      src={seed.sprite}
                      name={seed.name}
                      rarity={seed.rarity}
                      size={56}
                      itemId={seed.templateItemId}
                      quantity={seed.quantity}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {config?.seedYieldItem ? (
                          <Image
                            src={config.seedYieldItem.sprite}
                            alt=""
                            width={20}
                            height={20}
                            className="h-5 w-5 shrink-0 object-contain"
                          />
                        ) : null}
                        <span className="truncate text-sm font-semibold">
                          {cropName}
                        </span>
                        {isLast ? (
                          <span className="shrink-0 rounded-[6px] bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            Last planted
                          </span>
                        ) : null}
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.6fr)]">
                        <SeedFact
                          icon={Clock3}
                          label="Grows"
                          value={grow ? formatCompactDuration(grow) : "—"}
                        />
                        <SeedFact
                          icon={Sunrise}
                          label={ready?.day ? `Ready ${ready.day}` : "Ready"}
                          value={ready?.time ?? "—"}
                        />
                        <SeedFact
                          icon={PackageOpen}
                          label="Per plot"
                          value={
                            yieldMin !== null && yieldMax !== null
                              ? yieldMin === yieldMax
                                ? `${yieldMin}`
                                : `${yieldMin}–${yieldMax}`
                              : "—"
                          }
                        />
                        <SeedFact icon={Sparkles} label="XP" value={`+${xp}`} />
                      </dl>
                      {count > 0 && yieldMin !== null && yieldMax !== null ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {count} plot{count === 1 ? "" : "s"} →{" "}
                          <span className="text-foreground">
                            {count * yieldMin === count * yieldMax
                              ? count * yieldMin
                              : `${count * yieldMin}–${count * yieldMax}`}{" "}
                            {cropName}
                          </span>{" "}
                          · <span className="text-xp">+{count * xp} XP</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canPlant}
                    onClick={() => props.onPlant(seed, count)}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-primary/15 px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 sm:w-32"
                  >
                    <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
                    {count === 0
                      ? "Plant"
                      : count < props.targetCount
                        ? `Plant ${count} of ${props.targetCount}`
                        : `Plant ${count}`}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
