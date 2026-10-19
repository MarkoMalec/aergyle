import type {
  CreatureDamageType,
  DungeonDifficulty,
} from "~/generated/prisma/enums";
import { DUNGEON_DIFFICULTY_LABELS } from "~/game/creatures";
import { cn } from "~/lib/utils";
import type { Reward } from "./types";

/** Text and tint per difficulty; tints separate, borders never do. */
export const DIFFICULTY_TONE: Record<
  DungeonDifficulty,
  { text: string; tint: string; bar: string; glow: string }
> = {
  EASY: {
    text: "text-success",
    tint: "bg-success/[0.12]",
    bar: "bg-success",
    glow: "bg-[radial-gradient(70%_100%_at_0%_0%,hsl(var(--success)/0.1),transparent_70%)]",
  },
  NORMAL: {
    text: "text-info",
    tint: "bg-info/[0.12]",
    bar: "bg-info",
    glow: "bg-[radial-gradient(70%_100%_at_0%_0%,hsl(var(--info)/0.1),transparent_70%)]",
  },
  HARD: {
    text: "text-warning",
    tint: "bg-warning/[0.12]",
    bar: "bg-warning",
    glow: "bg-[radial-gradient(70%_100%_at_0%_0%,hsl(var(--warning)/0.1),transparent_70%)]",
  },
  DEADLY: {
    text: "text-danger",
    tint: "bg-danger/[0.14]",
    bar: "bg-danger",
    glow: "bg-[radial-gradient(70%_100%_at_0%_0%,hsl(var(--danger)/0.13),transparent_70%)]",
  },
};

export const DAMAGE_TYPE_TONE: Record<CreatureDamageType, string> = {
  FIRE: "text-danger",
  ICE: "text-info",
  LIGHTNING: "text-warning",
  POISON: "text-success",
};

export function DifficultyPill({
  difficulty,
  className,
}: {
  difficulty: DungeonDifficulty;
  className?: string;
}) {
  const tone = DIFFICULTY_TONE[difficulty];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] px-2 py-0.5 text-[11px] font-semibold",
        tone.tint,
        tone.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.bar)} />
      {DUNGEON_DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

export function formatRange(minimum: number, maximum: number) {
  const round = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${round(minimum)}–${round(maximum)}`;
}

export function listRewards(rewards: Reward[]) {
  return rewards
    .map((reward) => `${reward.name} ×${reward.quantity}`)
    .join(", ");
}
