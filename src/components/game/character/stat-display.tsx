"use client";

import { createContext, useContext, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Axe,
  Backpack,
  Clover,
  Coins,
  Crosshair,
  Droplet,
  Droplets,
  Feather,
  Fish,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HeartPulse,
  Leaf,
  Orbit,
  PawPrint,
  Pickaxe,
  Shield,
  ShieldCheck,
  ShieldHalf,
  Shrub,
  Skull,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  Waves,
  Wind,
  Zap,
  Bomb,
  type LucideIcon,
} from "lucide-react";
import { StatType, STAT_METADATA } from "~/types/stats";
import { cn } from "~/lib/utils";

/**
 * How a stat is drawn and written everywhere on the character page.
 *
 * Stat artwork: a square, transparent 256px WebP at
 * `public/assets/stats/<slug>.webp` replaces the line icon as soon as the file
 * is there (the page lists the folder). The minimum and maximum of a damage
 * range share one slug.
 */
type StatVisual = { slug: string; icon: LucideIcon; tone: string };

const STAT_VISUALS: Record<StatType, StatVisual> = {
  PHYSICAL_DAMAGE_MIN: {
    slug: "physical-damage",
    icon: Swords,
    tone: "text-warning",
  },
  PHYSICAL_DAMAGE_MAX: {
    slug: "physical-damage",
    icon: Swords,
    tone: "text-warning",
  },
  MAGIC_DAMAGE_MIN: { slug: "magic-damage", icon: Sparkles, tone: "text-info" },
  MAGIC_DAMAGE_MAX: { slug: "magic-damage", icon: Sparkles, tone: "text-info" },
  CRITICAL_CHANCE: {
    slug: "critical-chance",
    icon: Crosshair,
    tone: "text-warning",
  },
  CRITICAL_DAMAGE: {
    slug: "critical-damage",
    icon: Bomb,
    tone: "text-warning",
  },
  ATTACK_SPEED: { slug: "attack-speed", icon: Gauge, tone: "text-warning" },
  ACCURACY: { slug: "accuracy", icon: Target, tone: "text-success" },
  ARMOR: { slug: "armor", icon: Shield, tone: "text-text-secondary" },
  MAGIC_RESIST: { slug: "magic-resist", icon: ShieldHalf, tone: "text-info" },
  EVASION_MELEE: {
    slug: "evasion-melee",
    icon: Wind,
    tone: "text-text-secondary",
  },
  EVASION_RANGED: {
    slug: "evasion-ranged",
    icon: Feather,
    tone: "text-text-secondary",
  },
  EVASION_MAGIC: { slug: "evasion-magic", icon: Orbit, tone: "text-info" },
  BLOCK_CHANCE: {
    slug: "block-chance",
    icon: ShieldCheck,
    tone: "text-text-secondary",
  },
  FIRE_RESIST: { slug: "fire-resist", icon: Flame, tone: "text-danger" },
  COLD_RESIST: { slug: "cold-resist", icon: Snowflake, tone: "text-info" },
  LIGHTNING_RESIST: {
    slug: "lightning-resist",
    icon: Zap,
    tone: "text-warning",
  },
  POISON_RESIST: { slug: "poison-resist", icon: Skull, tone: "text-success" },
  HEALTH: { slug: "health", icon: Heart, tone: "text-danger" },
  MANA: { slug: "mana", icon: Droplets, tone: "text-info" },
  HEALTH_REGEN: { slug: "health-regen", icon: HeartPulse, tone: "text-danger" },
  MANA_REGEN: { slug: "mana-regen", icon: Waves, tone: "text-info" },
  PRAYER_POINTS: { slug: "prayer-points", icon: Sun, tone: "text-primary" },
  MOVEMENT_SPEED: {
    slug: "movement-speed",
    icon: Footprints,
    tone: "text-success",
  },
  LUCK: { slug: "luck", icon: Clover, tone: "text-success" },
  GOLD_FIND: { slug: "gold-find", icon: Coins, tone: "text-currency" },
  EXPERIENCE_GAIN: { slug: "experience-gain", icon: Star, tone: "text-xp" },
  LIFESTEAL: { slug: "lifesteal", icon: Droplet, tone: "text-danger" },
  THORNS: { slug: "thorns", icon: Shrub, tone: "text-success" },
  CARRYING_CAPACITY: {
    slug: "carrying-capacity",
    icon: Backpack,
    tone: "text-primary",
  },
  WOODCUTTING_EFFICIENCY: {
    slug: "woodcutting-efficiency",
    icon: Axe,
    tone: "text-primary",
  },
  MINING_EFFICIENCY: {
    slug: "mining-efficiency",
    icon: Pickaxe,
    tone: "text-primary",
  },
  FISHING_EFFICIENCY: {
    slug: "fishing-efficiency",
    icon: Fish,
    tone: "text-primary",
  },
  GATHERING_EFFICIENCY: {
    slug: "gathering-efficiency",
    icon: Leaf,
    tone: "text-primary",
  },
  HUNTING_EFFICIENCY: {
    slug: "hunting-efficiency",
    icon: PawPrint,
    tone: "text-primary",
  },
};

const StatArtContext = createContext<ReadonlySet<string>>(new Set());

/** Hands down which slugs have artwork in `public/assets/stats/`. */
export function StatArtProvider({
  slugs,
  children,
}: {
  slugs: string[];
  children: ReactNode;
}) {
  return (
    <StatArtContext.Provider value={new Set(slugs)}>
      {children}
    </StatArtContext.Provider>
  );
}

export function StatIcon({
  stat,
  size = 20,
  className,
}: {
  stat: StatType;
  size?: number;
  className?: string;
}) {
  const visual = STAT_VISUALS[stat];
  const art = useContext(StatArtContext);
  if (art.has(visual.slug)) {
    return (
      <Image
        src={`/assets/stats/${visual.slug}.webp`}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 object-contain", className)}
      />
    );
  }
  const Icon = visual.icon;
  return (
    <Icon
      size={size * 0.8}
      strokeWidth={1.75}
      className={cn("shrink-0", visual.tone, className)}
      aria-hidden="true"
    />
  );
}

const PER_SECOND = new Set<StatType>([
  StatType.ATTACK_SPEED,
  StatType.HEALTH_REGEN,
  StatType.MANA_REGEN,
]);

/** The value as the sheet shows it, so a change is only reported when the text changes. */
export function roundStat(stat: StatType, value: number) {
  const format = STAT_METADATA[stat].formatType;
  if (format === "percentage") return Math.round(value * 10) / 10;
  if (format === "decimal") return Math.round(value * 100) / 100;
  return Math.floor(value);
}

export function formatStat(stat: StatType, value: number) {
  const format = STAT_METADATA[stat].formatType;
  const rounded = roundStat(stat, value);
  const text =
    format === "percentage"
      ? `${rounded.toFixed(1)}%`
      : format === "decimal"
        ? rounded.toFixed(2)
        : new Intl.NumberFormat("en-US").format(rounded);
  return PER_SECOND.has(stat) ? `${text}/s` : text;
}

/** A signed change, e.g. "+12" or "−0.5%". */
export function formatStatChange(stat: StatType, change: number) {
  const format = STAT_METADATA[stat].formatType;
  const magnitude = Math.abs(change);
  const text =
    format === "percentage"
      ? `${magnitude.toFixed(1)}%`
      : format === "decimal"
        ? magnitude.toFixed(2)
        : new Intl.NumberFormat("en-US").format(magnitude);
  return `${change > 0 ? "+" : "−"}${text}`;
}

/**
 * The brief marker beside a value after an equipment change. A damage range
 * passes both ends; it reads "+2–5" when they move the same way, otherwise
 * the larger end.
 */
export function StatChange({
  stats,
  changes,
  className,
}: {
  stats: readonly StatType[];
  changes: Partial<Record<StatType, number>>;
  className?: string;
}) {
  const [first, second] = stats;
  if (!first) return null;
  const a = changes[first] ?? 0;
  const b = second ? changes[second] ?? 0 : 0;
  if (!a && !b) return null;

  let up: boolean;
  let text: string;
  if (second && a && b && Math.sign(a) === Math.sign(b)) {
    up = a > 0;
    text = `${formatStatChange(first, a)}–${formatStatChange(second, b).slice(1)}`;
  } else {
    const stat = b ? second! : first;
    const change = b || a;
    up = change > 0;
    text = formatStatChange(stat, change);
  }

  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-[5px] px-1 py-px text-[10px] font-semibold tabular-nums leading-4 duration-300 animate-in fade-in-0 slide-in-from-bottom-1",
        up ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
        className,
      )}
    >
      <Arrow size={10} strokeWidth={2.5} aria-hidden="true" />
      {text}
      <span className="sr-only">{up ? " increase" : " decrease"}</span>
    </span>
  );
}
