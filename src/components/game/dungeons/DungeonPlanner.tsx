import Link from "next/link";
import {
  Castle,
  Crosshair,
  LockKeyhole,
  Shield,
  ShieldHalf,
  Sparkles,
  Swords,
  Wind,
} from "lucide-react";
import type { CreatureAttackStyle } from "~/generated/prisma/enums";
import { DUNGEON_DIFFICULTY_LABELS } from "~/game/creatures";
import { Button } from "~/components/ui/button";
import { CreatureFaces, StatRow } from "~/components/game/expeditions/parts";
import { formatLength } from "~/components/game/actions/format";
import { cn } from "~/lib/utils";
import { DungeonBriefing, type Health } from "./DungeonBriefing";
import { DIFFICULTY_TONE, formatRange } from "./shared";
import type { CombatStats, Dungeon } from "./types";

function DungeonPicker(props: {
  dungeons: Dungeon[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const open = props.dungeons.filter((dungeon) => dungeon.unlocked).length;
  return (
    <section aria-labelledby="dungeon-picker-title">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 id="dungeon-picker-title" className="text-sm font-semibold">
          Dungeons here
        </h2>
        <span className="text-xs text-muted-foreground">
          {open} of {props.dungeons.length} open
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="Dungeon"
        className="grid gap-2 md:grid-cols-2 xl:grid-cols-1"
      >
        {props.dungeons.map((dungeon) => {
          const tone = DIFFICULTY_TONE[dungeon.difficulty];
          const selected = dungeon.id === props.selectedId;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected}
              disabled={!dungeon.unlocked}
              key={dungeon.id}
              onClick={() => props.onSelect(dungeon.id)}
              className="group relative flex w-full items-center gap-3 rounded-[12px] bg-card p-3 text-left shadow-[var(--shadow-panel)] transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card data-[selected=true]:bg-accent"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
              />
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]",
                  dungeon.unlocked
                    ? [tone.tint, tone.text]
                    : "bg-secondary/50 text-muted-foreground",
                )}
              >
                {dungeon.unlocked ? (
                  <Castle className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {dungeon.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {dungeon.unlocked
                    ? `${DUNGEON_DIFFICULTY_LABELS[dungeon.difficulty]} · ${formatLength(dungeon.durationSeconds)}`
                    : `Unlocks at level ${dungeon.requiredLevel}`}
                </span>
              </span>
              {dungeon.unlocked && dungeon.monsters.length > 0 ? (
                <CreatureFaces creatures={dungeon.monsters} decorative />
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

/** The character's fighting stats, read against the selected dungeon. */
function FighterStats({
  combat,
  dungeon,
}: {
  combat: CombatStats;
  dungeon: Dungeon | null;
}) {
  // Only the evasion that matches how this dungeon's monsters attack counts.
  const styles = [
    ...new Set(dungeon?.monsters.map((monster) => monster.attackStyle)),
  ];
  const evasion = (styles.length > 0 ? styles : (["MELEE"] as const)).map(
    (style) => EVASION_BY_STYLE[style],
  );

  return (
    <section
      aria-labelledby="fighter-stats-title"
      className="game-panel-flat p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="fighter-stats-title" className="text-sm font-semibold">
          Your fighter
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/inventory">Change gear</Link>
        </Button>
      </div>
      <dl className="grid gap-1.5 md:grid-cols-2 md:gap-x-3 xl:grid-cols-1">
        <StatRow
          icon={Swords}
          label="Damage"
          value={formatRange(
            combat.physicalDamageMin + combat.magicDamageMin,
            combat.physicalDamageMax + combat.magicDamageMax,
          )}
        />
        <StatRow
          icon={Shield}
          label="Armor"
          value={String(Math.floor(combat.armor))}
          note={
            dungeon
              ? `stops ${Math.round(dungeon.armorReduction * 100)}% here`
              : undefined
          }
        />
        <StatRow
          icon={Sparkles}
          label="Magic resist"
          value={`${combat.magicResist.toFixed(0)}%`}
        />
        <StatRow
          icon={Wind}
          label="Evasion"
          value={evasion
            .map((row) => `${combat[row.key].toFixed(0)}%`)
            .join(" · ")}
          note={evasion.map((row) => row.label).join(" · ")}
        />
        <StatRow
          icon={ShieldHalf}
          label="Block"
          value={`${combat.blockChance.toFixed(0)}%`}
        />
        <StatRow
          icon={Crosshair}
          label="Critical chance"
          value={`${combat.criticalChance.toFixed(0)}%`}
        />
      </dl>
    </section>
  );
}

export function DungeonPlanner(props: {
  dungeons: Dungeon[];
  selected: Dungeon | null;
  onSelect: (id: number) => void;
  combat: CombatStats;
  health: Health;
  entering: boolean;
  onEnter: () => void;
}) {
  const nextUnlock = props.dungeons
    .filter((dungeon) => !dungeon.unlocked)
    .reduce<
      number | null
    >((lowest, dungeon) => (lowest === null ? dungeon.requiredLevel : Math.min(lowest, dungeon.requiredLevel)), null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <DungeonPicker
          dungeons={props.dungeons}
          selectedId={props.selected?.id ?? null}
          onSelect={props.onSelect}
        />
      </div>
      <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        {props.selected ? (
          <DungeonBriefing
            dungeon={props.selected}
            health={props.health}
            entering={props.entering}
            onEnter={props.onEnter}
          />
        ) : (
          <div className="game-panel-flat game-empty-state">
            <LockKeyhole className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
            <strong>Every dungeon here is beyond your level.</strong>
            {nextUnlock !== null ? (
              <p className="mt-1 text-sm">
                The first opens at level {nextUnlock}.
              </p>
            ) : null}
          </div>
        )}
      </div>
      <div className="min-w-0 xl:col-start-1 xl:row-start-2 xl:self-start">
        <FighterStats combat={props.combat} dungeon={props.selected} />
      </div>
    </div>
  );
}
