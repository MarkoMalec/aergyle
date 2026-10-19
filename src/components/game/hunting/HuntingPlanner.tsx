import Image from "next/image";
import Link from "next/link";
import {
  Clover,
  Crosshair,
  Footprints,
  LockKeyhole,
  PawPrint,
  Shield,
  ShieldHalf,
  Wind,
} from "lucide-react";
import type { CreatureAttackStyle } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import { formatTime } from "~/components/game/actions/format";
import { CreatureFaces, StatRow } from "~/components/game/expeditions/parts";
import { cn } from "~/lib/utils";
import { HuntingBriefing, type Health } from "./HuntingBriefing";
import type { Duration, Ground, HuntingData, Safety } from "./types";

function GroundPicker(props: {
  grounds: Ground[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const open = props.grounds.filter((ground) => ground.unlocked).length;
  return (
    <section aria-labelledby="ground-picker-title">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 id="ground-picker-title" className="text-sm font-semibold">
          Hunting grounds
        </h2>
        <span className="text-xs text-muted-foreground">
          {open} of {props.grounds.length} open
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="Hunting ground"
        className="grid gap-2 sm:grid-cols-2"
      >
        {props.grounds.map((ground) => {
          const selected = ground.id === props.selectedId;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected}
              disabled={!ground.unlocked}
              key={ground.id}
              onClick={() => props.onSelect(ground.id)}
              className="group relative flex w-full items-center gap-3 rounded-[12px] bg-card p-3 text-left shadow-[var(--shadow-panel)] transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card data-[selected=true]:bg-accent"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
              />
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]",
                  ground.unlocked
                    ? "bg-primary/[0.12] text-primary"
                    : "bg-secondary/50 text-muted-foreground",
                )}
              >
                {ground.unlocked ? (
                  <PawPrint className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {ground.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {ground.unlocked
                    ? `${ground.creatures.length} species`
                    : `Unlocks at Hunting ${ground.requiredHuntingLevel}`}
                </span>
              </span>
              {ground.unlocked && ground.creatures.length > 0 ? (
                <CreatureFaces creatures={ground.creatures} decorative />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const EVASION_BY_STYLE: Record<
  CreatureAttackStyle,
  { key: "evasionMelee" | "evasionRanged" | "evasionMagic"; label: string }
> = {
  MELEE: { key: "evasionMelee", label: "melee" },
  RANGED: { key: "evasionRanged", label: "ranged" },
  MAGIC: { key: "evasionMagic", label: "magic" },
};

/** What the character brings to a hunt, read against the selected ground. */
function HunterStats({
  modifiers,
  ground,
}: {
  modifiers: HuntingData["modifiers"];
  ground: Ground | null;
}) {
  const { defenses } = modifiers;
  // Only the evasion that matches how these animals strike counts.
  const styles = [
    ...new Set(
      ground?.creatures
        .filter((animal) => animal.attackChance > 0)
        .map((animal) => animal.attackStyle),
    ),
  ];
  const evasion = (styles.length > 0 ? styles : (["MELEE"] as const)).map(
    (style) => EVASION_BY_STYLE[style],
  );
  const mishapFactor = Math.max(
    0.5,
    Math.min(1.5, 1 - (defenses.movementSpeed - 100) * 0.005),
  );
  const effect = modifiers.sources.activeEffect;

  return (
    <section
      aria-labelledby="hunter-stats-title"
      className="game-panel-flat p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="hunter-stats-title" className="text-sm font-semibold">
          Your hunter
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/profile">Change gear</Link>
        </Button>
      </div>
      <dl className="grid gap-1.5 sm:grid-cols-2 sm:gap-x-3">
        <StatRow
          icon={Clover}
          label="Luck"
          value={`${modifiers.luck >= 0 ? "+" : ""}${modifiers.luck}`}
          note="more finds"
        />
        <StatRow
          icon={Crosshair}
          label="Hunting efficiency"
          value={`+${modifiers.huntingEfficiency}%`}
        />
        <StatRow
          icon={Shield}
          label="Armor"
          value={String(Math.floor(defenses.armor))}
        />
        <StatRow
          icon={Wind}
          label="Evasion"
          value={evasion
            .map((row) => `${defenses[row.key].toFixed(0)}%`)
            .join(" · ")}
          note={evasion.map((row) => row.label).join(" · ")}
        />
        <StatRow
          icon={ShieldHalf}
          label="Block"
          value={`${defenses.blockChance.toFixed(0)}%`}
        />
        <StatRow
          icon={Footprints}
          label="Movement"
          value={String(Math.round(defenses.movementSpeed))}
          note={`mishaps ×${mishapFactor.toFixed(2)}`}
        />
      </dl>
      {effect ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-[10px] bg-primary/[0.08] px-3 py-2 text-sm">
          <Image
            src={effect.sprite}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 object-contain"
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted-foreground">Fed on </span>
            <span className="font-semibold">{effect.name}</span>
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            until {formatTime(effect.endsAt)}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function HuntingPlanner(props: {
  grounds: Ground[];
  selected: Ground | null;
  onSelect: (id: number) => void;
  durations: Duration[];
  duration: Duration | null;
  onSelectDuration: (id: number) => void;
  modifiers: HuntingData["modifiers"];
  safety: Safety;
  health: Health;
  starting: boolean;
  onStart: () => void;
}) {
  const nextUnlock = props.grounds
    .filter((ground) => !ground.unlocked)
    .reduce<
      number | null
    >((lowest, ground) => (lowest === null ? ground.requiredHuntingLevel : Math.min(lowest, ground.requiredHuntingLevel)), null);

  return (
    <div className="space-y-6">
      <GroundPicker
        grounds={props.grounds}
        selectedId={props.selected?.id ?? null}
        onSelect={props.onSelect}
      />
      {props.selected ? (
        <HuntingBriefing
          ground={props.selected}
          durations={props.durations}
          duration={props.duration}
          onSelectDuration={props.onSelectDuration}
          safety={props.safety}
          movementSpeed={props.modifiers.defenses.movementSpeed}
          health={props.health}
          starting={props.starting}
          onStart={props.onStart}
        />
      ) : (
        <div className="game-panel-flat game-empty-state">
          <LockKeyhole className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
          <strong>Every ground here needs more Hunting experience.</strong>
          {nextUnlock !== null ? (
            <p className="mt-1 text-sm">
              The first opens at Hunting {nextUnlock}.
            </p>
          ) : null}
        </div>
      )}
      <HunterStats modifiers={props.modifiers} ground={props.selected} />
    </div>
  );
}
