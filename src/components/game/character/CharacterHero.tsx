"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import { formatRemaining } from "~/components/game/actions/format";
import { cn } from "~/lib/utils";
import type { PlayerAvatar } from "./AvatarPicker";
import { useCharacterSheet } from "./CharacterSheetContext";
import { HEADLINE_ENTRIES, StatTooltip, formatEntry } from "./AttributeSheet";
import { StatChange, StatIcon } from "./stat-display";

const integer = new Intl.NumberFormat("en-US");

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export type HeroLevel = {
  level: number;
  xpProgress: number;
  xpRemaining: number;
};

function LevelMeter({ levelData }: { levelData: HeroLevel | null }) {
  const level = levelData?.level ?? 1;
  const percent = clampPercent(levelData?.xpProgress ?? 0);
  const circumference = 2 * Math.PI * 23;

  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-[54px] w-[54px] shrink-0 place-items-center">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 54 54"
          aria-hidden="true"
        >
          <circle cx="27" cy="27" r="23" fill="hsl(var(--background) / 0.55)" />
          <circle
            cx="27"
            cy="27"
            r="23"
            fill="none"
            stroke="hsl(var(--xp))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <span className="relative font-display text-lg font-bold tabular-nums text-primary">
          {level}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-semibold text-foreground">Level {level}</span>
          <span className="truncate tabular-nums text-muted-foreground">
            {levelData
              ? `${integer.format(Math.max(0, Math.ceil(levelData.xpRemaining)))} XP to ${level + 1}`
              : null}
          </span>
        </div>
        <div
          className="game-progress-track mt-1.5 bg-background/55"
          role="progressbar"
          aria-label="Experience to next level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(percent)}
        >
          <div
            className="game-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Health regenerates continuously; this counts it up between server reads. */
function useRegeneratingHealth(current: number, max: number, regen: number) {
  const [elapsed, setElapsed] = useState(0);
  const value = Math.min(
    max,
    Math.max(0, current) + elapsed * Math.max(0, regen),
  );
  const full = value >= max;

  useEffect(() => {
    setElapsed(0);
  }, [current]);

  useEffect(() => {
    if (full || regen <= 0) return;
    const start = performance.now() - elapsed * 1000;
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 1000);
    return () => window.clearInterval(timer);
    // `elapsed` only seeds the clock; restarting on every tick would drift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, regen]);

  return value;
}

function HealthMeter({ initialHealth }: { initialHealth: number }) {
  const { computed } = useCharacterSheet();
  const max = Math.max(1, computed.health);
  const health = useRegeneratingHealth(
    initialHealth,
    max,
    computed.healthRegen,
  );
  const percent = clampPercent((health / max) * 100);
  const missing = max - health;
  const secondsToFull =
    computed.healthRegen > 0 ? missing / computed.healthRegen : null;

  return (
    <div className="flex items-center gap-3">
      <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-danger/10">
        <Heart
          className="h-5 w-5 fill-danger/25 text-danger"
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-semibold tabular-nums text-foreground">
            {integer.format(Math.floor(health))}
            <span className="font-normal text-muted-foreground">
              {" "}
              / {integer.format(Math.floor(max))} health
            </span>
          </span>
          <span className="truncate tabular-nums text-muted-foreground">
            {missing < 1
              ? "Full"
              : secondsToFull !== null
                ? `Full in ${formatRemaining(secondsToFull)}`
                : null}
          </span>
        </div>
        <div
          className="mt-1.5 h-[7px] overflow-hidden rounded-lg bg-background/55"
          role="progressbar"
          aria-label="Health"
          aria-valuemin={0}
          aria-valuemax={Math.floor(max)}
          aria-valuenow={Math.floor(health)}
        >
          <div
            className="h-full rounded-lg bg-danger transition-[width] duration-700 ease-linear"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export const heroChipClass =
  "inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-lg bg-background/40 px-2.5 text-xs transition-colors duration-150";

/** The owner's own status: the running activity (live, linked) and location. */
export function StatusChips({ location }: { location: string | null }) {
  const { active, viewModel, activeActionType } =
    useVocationalActiveActionContext();
  // These labels already say what is happening ("Hunting in …").
  const selfDescribing =
    activeActionType === "TRAVEL" ||
    activeActionType === "GATHERING" ||
    activeActionType === "HUNTING" ||
    activeActionType === "DUNGEON";

  return (
    <div className="flex flex-wrap gap-2">
      {active && viewModel ? (
        <Link
          href={viewModel.href}
          className={cn(heroChipClass, "pl-1.5 hover:bg-background/60")}
        >
          {viewModel.sprite ? (
            <Image
              src={viewModel.sprite}
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] shrink-0 object-contain"
            />
          ) : (
            <span
              className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
          )}
          {selfDescribing ? null : (
            <span className="shrink-0 text-muted-foreground">
              {viewModel.skillLabel}
            </span>
          )}
          <span className="truncate font-medium text-foreground">
            {viewModel.label}
          </span>
        </Link>
      ) : (
        <span className={cn(heroChipClass, "text-muted-foreground")}>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60"
            aria-hidden="true"
          />
          Idle
        </span>
      )}
      {location ? (
        <Link
          href="/region"
          className={cn(heroChipClass, "hover:bg-background/60")}
        >
          <MapPin
            className="h-3.5 w-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="truncate font-medium text-foreground">
            {location}
          </span>
        </Link>
      ) : null}
    </div>
  );
}

function HeadlineStats() {
  const sheet = useCharacterSheet();

  return (
    <TooltipProvider delayDuration={150}>
      <ul
        aria-label="Combat summary"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2"
      >
        {HEADLINE_ENTRIES.map(({ entry, short }) => {
          const zero = entry.stats.every((stat) => sheet.final[stat] === 0);
          const boosted = entry.stats.some(
            (stat) => (sheet.meal[stat] ?? 0) !== 0,
          );
          return (
            <li key={entry.key} className="min-w-0">
              <StatTooltip entry={entry}>
                <div
                  tabIndex={0}
                  className="flex h-full min-w-0 items-center gap-2.5 rounded-xl bg-background/35 p-2 outline-none transition-colors duration-150 hover:bg-background/55 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card/70">
                    <StatIcon stat={entry.stats[0]} size={26} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                      {short}
                    </span>
                    <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5">
                      <strong
                        className={cn(
                          "truncate font-display text-[17px] font-semibold tabular-nums leading-snug tracking-[-0.02em]",
                          boosted
                            ? "text-primary"
                            : zero
                              ? "text-muted-foreground"
                              : "text-foreground",
                        )}
                      >
                        {formatEntry(entry, sheet.final)}
                      </strong>
                      <StatChange stats={entry.stats} changes={sheet.changes} />
                    </span>
                  </span>
                </div>
              </StatTooltip>
            </li>
          );
        })}
      </ul>
    </TooltipProvider>
  );
}

/**
 * The character hero's frame on a player's profile, /@Name, for its owner and
 * for everyone else: art lit by the avatar's backdrop, name, level,
 * health, status chips and the six headline stats.
 */
export function HeroShell({
  avatar,
  name,
  subtitle,
  levelData,
  initialHealth,
  status,
  actions,
  artAction,
  children,
}: {
  avatar: PlayerAvatar;
  name: string;
  /** The line under the name. */
  subtitle: ReactNode;
  levelData: HeroLevel | null;
  /** Current health when the page was rendered. */
  initialHealth: number;
  status: ReactNode;
  actions?: ReactNode;
  /** Pinned to the art's bottom-left corner. */
  artAction?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="character-name"
      className="relative isolate mb-5 overflow-hidden rounded-lg bg-card shadow-[var(--shadow-panel)]"
    >
      {/* The character's own colour, lit behind the figure. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-full max-w-[720px] opacity-90 [mask-image:linear-gradient(to_right,#000_20%,transparent_80%)]"
        style={{ background: avatar.backdrop }}
      />

      {/*
        Phones: portrait beside the name, then meters and stats full width.
        From sm the portrait spans the name and meters; from xl the stats
        take a third column.
      */}
      <div className="grid grid-cols-[112px_minmax(0,1fr)] [grid-template-areas:'art_id'_'meters_meters'_'stats_stats'] sm:grid-cols-[176px_minmax(0,1fr)] sm:[grid-template-areas:'art_id'_'art_meters'_'stats_stats'] xl:grid-cols-[208px_minmax(0,1fr)_minmax(300px,372px)] xl:[grid-template-areas:'art_id_stats'_'art_meters_stats']">
        <div className="relative min-h-[168px] [grid-area:art] sm:min-h-[236px]">
          <div className="absolute -left-2 right-0 top-2 h-[150%] [mask-image:linear-gradient(to_bottom,#000_45%,transparent_66%)] sm:-right-4">
            <Image
              src={avatar.src}
              alt={`${avatar.name}, ${avatar.role}`}
              fill
              sizes="(max-width: 640px) 140px, 230px"
              className="pointer-events-none select-none object-contain object-top drop-shadow-[0_14px_24px_rgb(0_0_0/0.45)]"
              priority
            />
          </div>
          {artAction}
        </div>

        <div className="min-w-0 self-center py-5 pr-4 [grid-area:id] sm:self-end sm:pb-0 sm:pr-6 sm:pt-6 xl:pr-2">
          <p className="game-eyebrow truncate">{avatar.role}</p>
          <h1
            id="character-name"
            className="mt-0.5 truncate font-display text-[26px] font-[650] leading-[1.15] tracking-[-0.04em] text-foreground sm:text-[32px]"
          >
            {name}
          </h1>
          <div className="mt-1 min-w-0 text-xs text-muted-foreground">
            {subtitle}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 px-4 pb-5 [grid-area:meters] sm:self-start sm:pl-0 sm:pr-6 sm:pt-4 xl:pb-6 xl:pr-2">
          <div className="grid gap-3">
            <LevelMeter levelData={levelData} />
            <HealthMeter initialHealth={initialHealth} />
          </div>
          {status}
          {actions ? (
            <div className="flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>

        <div className="min-w-0 bg-background/20 p-3 [grid-area:stats] sm:p-4 xl:self-center xl:bg-transparent xl:py-6 xl:pl-4 xl:pr-6">
          <HeadlineStats />
        </div>
      </div>

      {children}
    </section>
  );
}
