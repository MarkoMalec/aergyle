import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Castle, Crosshair } from "lucide-react";
import type { CreatureKind } from "~/generated/prisma/enums";
import {
  ATTACK_STYLE_LABELS,
  BESTIARY_PATHS,
  DAMAGE_TYPE_LABELS,
} from "~/game/creatures";
import { CreatureLootTile } from "~/components/game/creatures/CreatureLootTile";
import { Button } from "~/components/ui/button";
import type { CreatureProfileData } from "~/server/creatures/catalogue";

const COPY = {
  ANIMAL: {
    noun: "Animal",
    back: "All animals",
    habitatTitle: "Hunting grounds",
    habitatHref: "/skills/Hunting",
    habitatIcon: Crosshair,
    habitatEmpty: "Not currently tracked in any hunting ground.",
    lootTitle: "What a hunt can bring home",
    requirement: (level: number) => `Hunting ${level}`,
  },
  MONSTER: {
    noun: "Monster",
    back: "All monsters",
    habitatTitle: "Dungeons",
    habitatHref: "/dungeons",
    habitatIcon: Castle,
    habitatEmpty: "Not currently lurking in any dungeon.",
    lootTitle: "What it may carry",
    requirement: (level: number) => `Level ${level}`,
  },
} as const;

type StatRow = { label: string; value: string };

const surface = "rounded-2xl bg-card shadow-[var(--shadow-panel)]";

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function range(minimum: number, maximum: number) {
  return `${minimum}–${maximum}`;
}

function attackStats(creature: CreatureProfileData): StatRow[] {
  const rows: StatRow[] = [
    { label: "Attack style", value: ATTACK_STYLE_LABELS[creature.attackStyle] },
  ];
  if (creature.damageMax > 0) {
    rows.push({
      label: "Physical damage",
      value: range(creature.damageMin, creature.damageMax),
    });
  }
  if (creature.magicDamageMax > 0) {
    rows.push({
      label: "Magic damage",
      value: range(creature.magicDamageMin, creature.magicDamageMax),
    });
  }
  if (creature.damageType && creature.elementalDamageMax > 0) {
    rows.push({
      label: `${DAMAGE_TYPE_LABELS[creature.damageType]} damage`,
      value: range(creature.elementalDamageMin, creature.elementalDamageMax),
    });
  }
  if (creature.critChance > 0) {
    rows.push({
      label: "Critical chance",
      value: `${formatNumber(creature.critChance)}%`,
    });
    rows.push({
      label: "Critical damage",
      value: `×${(Math.max(100, creature.critDamage) / 100).toFixed(2)}`,
    });
  }
  return rows;
}

function defenceStats(creature: CreatureProfileData): StatRow[] {
  const rows: Array<[string, number, string]> = [
    ["Health", creature.health, ""],
    ["Armor", creature.armor, ""],
    ["Magic resist", creature.magicResist, ""],
    ["Evasion", creature.evasion, "%"],
    ["Block chance", creature.blockChance, "%"],
  ];
  // Animals usually have no defensive profile; hide an all-zero group.
  if (rows.every(([, value]) => value <= 0)) return [];
  return rows.map(([label, value, suffix]) => ({
    label,
    value: `${formatNumber(value)}${suffix}`,
  }));
}

function StatGroup({ title, rows }: { title: string; rows: StatRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </h3>
      <dl className="space-y-0.5">
        {rows.map((row) => (
          <div
            className="flex items-baseline justify-between gap-4 rounded-lg px-3 py-2 odd:bg-white/[0.035]"
            key={row.label}
          >
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function CreatureProfile({
  kind,
  creature,
}: {
  kind: CreatureKind;
  creature: CreatureProfileData;
}) {
  const copy = COPY[kind];
  const HabitatIcon = copy.habitatIcon;
  const damageTypeClass = creature.damageType === "POISON" ? "bg-green-300/15 text-green-500" : creature.damageType === "FIRE" ? "bg-orange-500/15 text-orange-500" : creature.damageType === "ICE" ? "bg-blue-500/15 text-blue-500" : creature.damageType === "LIGHTNING" ? "bg-yellow-500/15 text-yellow-500" : "bg-muted-foreground/15 text-muted-foreground";
  return (
    <main className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={BESTIARY_PATHS[kind]}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {copy.back}
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div
            className={`${surface} mx-auto flex aspect-square w-full max-w-[340px] items-center justify-center p-6`}
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 58%, hsl(var(--primary) / 0.14), transparent 68%)",
            }}
          >
            <Image
              src={creature.asset}
              alt={creature.name}
              width={320}
              height={320}
              priority
              className="h-full w-full object-contain drop-shadow-[0_18px_24px_rgba(6,12,16,0.55)]"
            />
          </div>

          <section className={`${surface} space-y-5 p-4`}>
            <h2 className="game-section-title px-3 pt-1">Stats</h2>
            <StatGroup title="Attack" rows={attackStats(creature)} />
            <StatGroup title="Defence" rows={defenceStats(creature)} />
          </section>
        </aside>

        <div className="min-w-0 space-y-6">
          <header className="space-y-3 pt-1">
            <p className="game-eyebrow">{copy.noun}</p>
            <h1 className="game-page-title">{creature.name}</h1>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-secondary px-3 py-1">
                {ATTACK_STYLE_LABELS[creature.attackStyle]}
              </span>
              {creature.damageType ? (
                <span className={`rounded-full px-3 py-1 ${damageTypeClass}`}>
                  {DAMAGE_TYPE_LABELS[creature.damageType]}
                </span>
              ) : null}
            </div>
            {creature.description ? (
              <p className="max-w-prose text-base leading-relaxed text-text-secondary">
                {creature.description}
              </p>
            ) : null}
          </header>

          <section className={`${surface} p-5 sm:p-6`}>
            <h2 className="game-section-title mb-4">{copy.habitatTitle}</h2>
            {creature.habitats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.habitatEmpty}
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {creature.habitats.map((habitat) => (
                  <li key={habitat.id}>
                    <Link
                      href={copy.habitatHref}
                      className="flex items-center gap-3 rounded-xl bg-secondary/30 p-3 transition-colors hover:bg-accent"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <HabitatIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">
                          {habitat.name}
                        </strong>
                        <span className="text-xs text-muted-foreground">
                          {habitat.locationName}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${surface} p-5 sm:p-6`}>
            <h2 className="game-section-title mb-4">{copy.lootTitle}</h2>
            {creature.loot.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing worth keeping.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {creature.loot.map((item) => (
                  <CreatureLootTile
                    key={item.id}
                    itemId={item.id}
                    name={item.name}
                    sprite={item.sprite}
                    rarity={item.rarity}
                    requirement={
                      item.requiredLevel > 1
                        ? copy.requirement(item.requiredLevel)
                        : null
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
