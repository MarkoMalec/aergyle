import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Clock3,
  HeartPulse,
  Info,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import {
  ATTACK_STYLE_LABELS,
  bestiaryHref,
  DAMAGE_TYPE_LABELS,
} from "~/game/creatures";
import { Button } from "~/components/ui/button";
import { ATTACK_STYLE_ICON, Fact } from "~/components/game/expeditions/parts";
import { formatLength, formatWait } from "~/components/game/actions/format";
import { cn } from "~/lib/utils";
import { DAMAGE_TYPE_TONE, DIFFICULTY_TONE, DifficultyPill } from "./shared";
import type { Dungeon, DungeonMonster } from "./types";

export type Health = {
  current: number;
  max: number;
  regen: number;
  /** Meets the minimum share of health every dungeon needs to start. */
  ready: boolean;
  minimumPercent: number;
};

type Tone = "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, { text: string; tint: string }> = {
  success: { text: "text-success", tint: "bg-success/[0.12]" },
  warning: { text: "text-warning", tint: "bg-warning/[0.12]" },
  danger: { text: "text-danger", tint: "bg-danger/[0.14]" },
};

function secondsUntil(health: Health, target: number) {
  return health.regen > 0
    ? Math.max(0, (target - health.current) / health.regen)
    : null;
}

/** How the character's health measures up to what this dungeon demands. */
function survivalVerdict(
  dungeon: Dungeon,
  health: Health,
): { tone: Tone; label: string; text: string } {
  const recommended = dungeon.recommendedHealth;
  if (recommended === null) {
    return {
      tone: "danger",
      label: "Beyond your gear",
      text: "Its monsters overwhelm you in most fights. Come back with stronger gear.",
    };
  }
  if (recommended > health.max) {
    return {
      tone: "danger",
      label: "Too dangerous",
      text: `It calls for ${recommended} health, more than your maximum. Expect to fall.`,
    };
  }
  if (!health.ready) {
    const wait = secondsUntil(
      health,
      (health.minimumPercent / 100) * health.max,
    );
    return {
      tone: "warning",
      label: "Recover first",
      text: `Recover to ${health.minimumPercent}% health to enter${wait === null ? "" : `, in about ${formatWait(wait)}`}.`,
    };
  }
  if (recommended > health.current) {
    const wait = secondsUntil(health, recommended);
    return {
      tone: "warning",
      label: "Risky",
      text: `You are below the recommended ${recommended} health${wait === null ? "" : `; you reach it in about ${formatWait(wait)}`}.`,
    };
  }
  return {
    tone: "success",
    label: "Ready",
    text: `You meet the recommended ${recommended} health.`,
  };
}

function SurvivalGauge({
  dungeon,
  health,
}: {
  dungeon: Dungeon;
  health: Health;
}) {
  const verdict = survivalVerdict(dungeon, health);
  const tone = TONE_CLASSES[verdict.tone];
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const scale = Math.max(1, health.max);
  const fill = clamp(health.current / scale);
  const recommended = dungeon.recommendedHealth;
  const mark = recommended === null ? null : clamp(recommended / scale);

  return (
    <section
      aria-label="Survival"
      className="rounded-[12px] bg-surface-inset/60 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <HeartPulse className="h-4 w-4 text-danger" aria-hidden="true" />
          Survival
        </h3>
        <span
          className={cn(
            "rounded-[7px] px-2 py-0.5 text-[11px] font-semibold",
            tone.tint,
            tone.text,
          )}
        >
          {verdict.label}
        </span>
      </div>

      <div className={cn("relative", mark === null ? "mt-4" : "mt-8")}>
        {mark !== null ? (
          <span
            className={cn(
              "absolute -top-6 whitespace-nowrap text-[11px] font-semibold tabular-nums",
              mark > 0.85
                ? "-translate-x-full"
                : mark < 0.15
                  ? ""
                  : "-translate-x-1/2",
            )}
            style={{ left: `${mark * 100}%` }}
          >
            Needs {recommended}
          </span>
        ) : null}
        <div
          className="h-2.5 overflow-hidden rounded-full bg-black/30"
          role="progressbar"
          aria-label="Current health"
          aria-valuemin={0}
          aria-valuemax={Math.floor(health.max)}
          aria-valuenow={Math.floor(health.current)}
        >
          <div
            className="h-full rounded-full bg-danger transition-[width]"
            style={{ width: `${fill * 100}%` }}
          />
        </div>
        {mark !== null ? (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${mark * 100}%` }}
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">
            {Math.floor(health.current)}
          </strong>{" "}
          / {Math.floor(health.max)} health
        </span>
        <span>Regenerates {health.regen.toFixed(1)}/s</span>
      </div>
      <p className={cn("mt-3 text-xs leading-relaxed", tone.text)}>
        {verdict.text}
      </p>
    </section>
  );
}

function MonsterTile({ monster }: { monster: DungeonMonster }) {
  const StyleIcon = ATTACK_STYLE_ICON[monster.attackStyle];
  return (
    <li>
      <Link
        href={bestiaryHref("MONSTER", monster.id)}
        className="group flex items-center gap-3 rounded-[12px] bg-surface-inset/50 p-2 pr-3 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src={monster.asset}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-[10px] bg-black/20 object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{monster.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <StyleIcon className="h-3 w-3" aria-hidden="true" />
              {ATTACK_STYLE_LABELS[monster.attackStyle]}
            </span>
            {monster.damageType ? (
              <span className={DAMAGE_TYPE_TONE[monster.damageType]}>
                {DAMAGE_TYPE_LABELS[monster.damageType]} damage
              </span>
            ) : null}
          </p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export function DungeonBriefing(props: {
  dungeon: Dungeon;
  health: Health;
  entering: boolean;
  onEnter: () => void;
}) {
  const { dungeon, health } = props;
  const blocker = !dungeon.unlocked
    ? `Requires character level ${dungeon.requiredLevel}.`
    : dungeon.monsters.length === 0
      ? "Nothing stirs here right now."
      : !health.ready
        ? `Recover to ${health.minimumPercent}% health before entering.`
        : null;

  return (
    <article className="game-panel-flat relative isolate overflow-hidden">
      {/* Each difficulty lights the briefing in its own colour */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 -z-10 h-56",
          DIFFICULTY_TONE[dungeon.difficulty].glow,
        )}
      />
      <div className="space-y-6 p-5 sm:p-6">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyPill difficulty={dungeon.difficulty} />
            <span className="rounded-[7px] bg-secondary/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Level {dungeon.requiredLevel}
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
            {dungeon.name}
          </h2>
          {dungeon.description ? (
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-secondary">
              {dungeon.description}
            </p>
          ) : null}
        </header>

        <dl className="grid grid-cols-3 gap-2">
          <Fact
            icon={Clock3}
            label="Duration"
            value={formatLength(dungeon.durationSeconds)}
          />
          <Fact
            icon={Sparkles}
            label="On clear"
            value={`+${dungeon.xpReward.toLocaleString()} XP`}
            tone="text-xp"
          />
          <Fact
            icon={Users}
            label="Enemies"
            value={
              dungeon.packSize <= 1
                ? "One at a time"
                : `Up to ${dungeon.packSize} at once`
            }
          />
        </dl>

        <SurvivalGauge dungeon={dungeon} health={health} />

        <section aria-label="Inhabitants">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Inhabitants</h3>
            <span className="text-xs text-muted-foreground">
              {dungeon.monsters.length}{" "}
              {dungeon.monsters.length === 1 ? "kind" : "kinds"} sighted
            </span>
          </div>
          {dungeon.monsters.length === 0 ? (
            <p className="rounded-[12px] bg-surface-inset/50 p-4 text-sm text-muted-foreground">
              Nothing stirs here right now.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {dungeon.monsters.map((monster) => (
                <MonsterTile monster={monster} key={monster.id} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="flex flex-col gap-3 bg-surface-inset/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p
          className={cn(
            "flex items-start gap-2 text-xs leading-relaxed",
            blocker ? "text-warning" : "text-muted-foreground",
          )}
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {blocker ??
            "You fight with your current health and gear. Leaving early is safe, but you keep nothing."}
        </p>
        <Button
          className="shrink-0 sm:min-w-[184px]"
          disabled={Boolean(blocker) || props.entering}
          onClick={props.onEnter}
        >
          <Swords className="h-4 w-4" aria-hidden="true" />
          {props.entering ? "Descending…" : "Enter dungeon"}
        </Button>
      </footer>
    </article>
  );
}
