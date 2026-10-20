import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Compass,
  HeartPulse,
  Info,
  LockKeyhole,
  PawPrint,
  Sparkles,
} from "lucide-react";
import {
  ATTACK_STYLE_LABELS,
  bestiaryHref,
  describeCreatureDamage,
} from "~/game/creatures";
import { Button } from "~/components/ui/button";
import { formatWait } from "~/components/game/actions/format";
import { ATTACK_STYLE_ICON, Fact } from "~/components/game/expeditions/parts";
import { cn } from "~/lib/utils";
import type { Animal, Duration, Ground, Safety } from "./types";

export type Health = {
  current: number;
  max: number;
  regen: number;
  /** Meets the minimum share of health a hunt needs to start. */
  ready: boolean;
};

type Tone = "success" | "warning" | "danger" | "muted";

const TONE_CLASSES: Record<Tone, { text: string; tint: string }> = {
  success: { text: "text-success", tint: "bg-success/[0.12]" },
  warning: { text: "text-warning", tint: "bg-warning/[0.12]" },
  danger: { text: "text-danger", tint: "bg-danger/[0.14]" },
  muted: { text: "text-muted-foreground", tint: "bg-secondary/60" },
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

/**
 * The server only rolls animals with weight and at least one drop unlocked at
 * the character's Hunting level.
 */
function inPool(animal: Animal) {
  return (
    animal.encounterWeight > 0 && animal.drops.some((drop) => drop.unlocked)
  );
}

/** Lowest Hunting level that unlocks one of the animal's drops. */
function unlockLevel(animal: Animal) {
  return Math.min(...animal.drops.map((drop) => drop.requiredHuntingLevel));
}

/** The same chances the resolver rolls, for the chosen duration. */
export function huntOdds(params: {
  ground: Ground;
  duration: Duration | null;
  safety: Safety;
  movementSpeed: number;
}) {
  const scale =
    (params.duration?.dangerMultiplier ?? 1) *
    params.safety.globalDangerMultiplier;
  const movementFactor = clamp(
    1 - (params.movementSpeed - 100) * 0.005,
    0.5,
    1.5,
  );
  const attack = (animal: Animal) =>
    clamp(clamp(animal.attackChance, 0, 1) * scale, 0, 0.95);
  // Each encounter picks one animal from the rolled pool by weight.
  const pool = params.ground.creatures.filter(inPool);
  const totalWeight = pool.reduce(
    (sum, animal) => sum + animal.encounterWeight,
    0,
  );
  const averageAttack =
    totalWeight > 0
      ? pool.reduce(
          (sum, animal) =>
            sum + (animal.encounterWeight / totalWeight) * attack(animal),
          0,
        )
      : 0;
  return {
    /** Share of encounters that meet this animal. */
    share: (animal: Animal) =>
      inPool(animal) && totalWeight > 0
        ? animal.encounterWeight / totalWeight
        : 0,
    scale,
    mishap: clamp(
      params.ground.accidentChance * scale * movementFactor,
      0,
      0.95,
    ),
    attack,
    /** Chance an encounter's animal strikes back, before evasion. */
    averageAttack,
  };
}

/** Labels a per-encounter chance, given as a fraction. */
function riskLevel(chance: number): { label: string; tone: Tone } | null {
  const percent = chance * 100;
  if (percent <= 0) return null;
  if (percent <= 3) return { label: "Minimal", tone: "success" };
  if (percent <= 5) return { label: "Low", tone: "success" };
  if (percent <= 9) return { label: "Guarded", tone: "warning" };
  if (percent <= 15) return { label: "Risky", tone: "warning" };
  return { label: "Dangerous", tone: "danger" };
}

function frequency(share: number) {
  return share >= 0.4 ? "Common" : share >= 0.15 ? "Uncommon" : "Rare";
}

function RiskGauge(props: {
  ground: Ground;
  duration: Duration | null;
  odds: ReturnType<typeof huntOdds>;
  safety: Safety;
  health: Health;
}) {
  const { health, safety, odds } = props;
  const harmless = !safety.damageEnabled || odds.scale <= 0;
  const floor = Math.max(
    1,
    (safety.minimumRemainingHealthPercent / 100) * health.max,
  );
  const cap = (safety.maxHealthLossPercent / 100) * health.max;
  const atRisk = harmless
    ? 0
    : clamp(Math.min(cap, health.current - floor), 0, health.max);
  const scale = Math.max(1, health.max);
  const safePart = clamp((health.current - atRisk) / scale, 0, 1);
  const riskPart = clamp(atRisk / scale, 0, 1 - safePart);

  // Chance an encounter brings a strike or a mishap, and how many to expect.
  const perEncounter = 1 - (1 - odds.averageAttack) * (1 - odds.mishap);
  const level = riskLevel(perEncounter);
  // The resolver rolls at most 100 encounters.
  const encounters = Math.min(
    100,
    Math.floor(props.duration?.encounterRolls ?? 0),
  );
  const expected = encounters * (odds.averageAttack + odds.mishap);
  const percent = (chance: number) =>
    chance > 0 && chance < 0.005 ? "under 1%" : `${Math.round(chance * 100)}%`;
  const minimum = safety.minimumHealthToStartPercent;
  const recoverIn =
    health.regen > 0
      ? Math.max(
          0,
          ((minimum / 100) * health.max - health.current) / health.regen,
        )
      : null;

  const verdict: { label: string; tone: Tone; text: string } = harmless
    ? {
        label: "No danger",
        tone: "success",
        text: "Animals and mishaps can't hurt you right now.",
      }
    : !health.ready
      ? {
          label: "Recover first",
          tone: "warning",
          text: `Recover to ${minimum}% health to set out${recoverIn === null ? "" : `, in about ${formatWait(recoverIn)}`}.`,
        }
      : level
        ? {
            label:
              level.tone === "success" ? `${level.label} risk` : level.label,
            tone: level.tone,
            text: `Animals strike back in ${percent(odds.averageAttack)} of encounters and mishaps hit ${percent(odds.mishap)}. ${
              expected < 0.5
                ? `Over ${encounters} encounters you will most likely come back untouched.`
                : `Over ${encounters} encounters, expect about ${Math.round(expected)} ${Math.round(expected) === 1 ? "strike or mishap" : "strikes or mishaps"}.`
            }`,
          }
        : { label: "Safe", tone: "success", text: "Nothing here fights back." };
  const tone = TONE_CLASSES[verdict.tone];

  return (
    <section
      aria-label="Risk"
      className="rounded-[12px] bg-surface-inset/60 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <HeartPulse className="h-4 w-4 text-danger" aria-hidden="true" />
          Risk
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

      <div
        className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-black/30"
        role="progressbar"
        aria-label="Current health"
        aria-valuemin={0}
        aria-valuemax={Math.floor(health.max)}
        aria-valuenow={Math.floor(health.current)}
      >
        <div
          className="h-full bg-danger transition-[width]"
          style={{ width: `${safePart * 100}%` }}
        />
        <div
          className="h-full bg-[repeating-linear-gradient(135deg,hsl(var(--danger)/0.75)_0_4px,hsl(var(--danger)/0.25)_4px_8px)] transition-[width]"
          style={{ width: `${riskPart * 100}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground">
            {Math.floor(health.current)}
          </strong>{" "}
          / {Math.floor(health.max)} health · regenerates{" "}
          {health.regen.toFixed(1)}/s
        </span>
        {atRisk > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-[2px] bg-[repeating-linear-gradient(135deg,hsl(var(--danger)/0.75)_0_3px,hsl(var(--danger)/0.25)_3px_6px)]" />
            Up to {Math.round(atRisk)} at stake
          </span>
        ) : null}
      </div>
      <p className={cn("mt-3 text-xs leading-relaxed", tone.text)}>
        {verdict.text}
      </p>
      {!harmless ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A hunt never takes more than {safety.maxHealthLossPercent}% of your
          maximum health, and never leaves you below{" "}
          {safety.minimumRemainingHealthPercent}%.
        </p>
      ) : null}
    </section>
  );
}

function AnimalRow(props: { animal: Animal; share: number; chance: number }) {
  const { animal } = props;
  const StyleIcon = ATTACK_STYLE_ICON[animal.attackStyle];
  const reachable = inPool(animal);
  const level = riskLevel(props.chance);
  const tone = TONE_CLASSES[level?.tone ?? "muted"];
  return (
    <li>
      <Link
        href={bestiaryHref("ANIMAL", animal.id)}
        className={cn(
          "group flex items-center gap-3 rounded-[12px] bg-surface-inset/50 p-2 pr-3 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !reachable && "opacity-60",
        )}
      >
        <Image
          src={animal.asset}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-[10px] bg-black/20 object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{animal.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-text-secondary">
              {reachable
                ? frequency(props.share)
                : animal.drops.length > 0
                  ? `Needs Hunting ${unlockLevel(animal)}`
                  : "Not hunted"}
            </span>
            {animal.attackChance > 0 ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <StyleIcon className="h-3 w-3" aria-hidden="true" />
                  {ATTACK_STYLE_LABELS[animal.attackStyle]}
                </span>
                {describeCreatureDamage(animal).map((part) => (
                  <span key={part}>{part}</span>
                ))}
              </>
            ) : (
              <span>Never strikes back</span>
            )}
          </p>
        </div>
        {reachable ? (
          <span
            className={cn(
              "shrink-0 rounded-[7px] px-2 py-0.5 text-[11px] font-semibold",
              tone.tint,
              tone.text,
            )}
            title={
              level
                ? `Strikes back ${Math.round(props.chance * 100)}% of the time`
                : undefined
            }
          >
            {level?.label ?? "Harmless"}
          </span>
        ) : null}
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export function HuntingBriefing(props: {
  ground: Ground;
  durations: Duration[];
  duration: Duration | null;
  onSelectDuration: (id: number) => void;
  safety: Safety;
  movementSpeed: number;
  health: Health;
  starting: boolean;
  onStart: () => void;
}) {
  const { ground, duration, safety, health } = props;
  const odds = huntOdds({
    ground,
    duration,
    safety,
    movementSpeed: props.movementSpeed,
  });
  const hasUsableDrop = ground.creatures.some((animal) =>
    animal.drops.some((drop) => drop.unlocked),
  );
  const blocker = !ground.unlocked
    ? `Requires Hunting ${ground.requiredHuntingLevel}.`
    : !duration
      ? "No hunt length is open at your Hunting level yet."
      : !hasUsableDrop
        ? "Nothing here yields materials at your Hunting level yet."
        : !health.ready
          ? `Recover to ${safety.minimumHealthToStartPercent}% health before setting out.`
          : null;

  return (
    <article className="game-panel-flat relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(70%_100%_at_0%_0%,hsl(var(--primary)/0.08),transparent_70%)]"
      />
      <div className="space-y-6 p-5 sm:p-6">
        <header>
          <span className="rounded-[7px] bg-secondary/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Hunting {ground.requiredHuntingLevel}
          </span>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
            {ground.name}
          </h2>
          {ground.description ? (
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-secondary">
              {ground.description}
            </p>
          ) : null}
        </header>

        <section aria-labelledby="hunt-length-title">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id="hunt-length-title" className="text-sm font-semibold">
              Time away
            </h3>
            <span className="text-xs text-muted-foreground">
              Longer hunts find more, and risk more.
            </span>
          </div>
          <div
            role="radiogroup"
            aria-labelledby="hunt-length-title"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {props.durations.map((row) => {
              const selected = row.id === duration?.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-selected={selected}
                  disabled={!row.unlocked}
                  key={row.id}
                  onClick={() => props.onSelectDuration(row.id)}
                  className="group rounded-[10px] bg-surface-inset/60 px-3 py-2.5 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-surface-inset/60 data-[selected=true]:bg-primary/[0.14]"
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold group-data-[selected=true]:text-primary">
                    {row.unlocked ? null : (
                      <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {row.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                    {row.unlocked
                      ? `+${row.xpReward.toLocaleString()} XP`
                      : `Hunting ${row.requiredHuntingLevel}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <dl className="grid grid-cols-3 gap-2">
          <Fact
            icon={PawPrint}
            label="Encounters"
            value={duration ? String(duration.encounterRolls) : "—"}
          />
          <Fact
            icon={Sparkles}
            label="Experience"
            value={duration ? `+${duration.xpReward.toLocaleString()} XP` : "—"}
            tone="text-xp"
          />
          <Fact
            icon={AlertTriangle}
            label="Mishaps"
            value={
              safety.damageEnabled && odds.scale > 0
                ? `${Math.round(odds.mishap * 100)}% each`
                : "None"
            }
          />
        </dl>

        <RiskGauge
          ground={ground}
          duration={duration}
          odds={odds}
          safety={safety}
          health={health}
        />

        <section aria-label="Animals">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Animals</h3>
            <span className="text-xs text-muted-foreground">
              {ground.creatures.length} species tracked
            </span>
          </div>
          {ground.creatures.length === 0 ? (
            <p className="rounded-[12px] bg-surface-inset/50 p-4 text-sm text-muted-foreground">
              No animals roam here right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {ground.creatures.map((animal) => (
                <AnimalRow
                  key={animal.id}
                  animal={animal}
                  share={odds.share(animal)}
                  chance={
                    safety.damageEnabled && odds.share(animal) > 0
                      ? odds.attack(animal)
                      : 0
                  }
                />
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
            "Your gear is locked in when you set out. Coming back early is safe, but empty-handed."}
        </p>
        <Button
          className="shrink-0 sm:min-w-[184px]"
          disabled={Boolean(blocker) || props.starting}
          onClick={props.onStart}
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
          {props.starting ? "Preparing…" : "Begin hunting"}
        </Button>
      </footer>
    </article>
  );
}
