import Image from "next/image";
import Link from "next/link";
import {
  Clock3,
  Clover,
  Compass,
  Info,
  Layers,
  LockKeyhole,
  Package,
  Search,
  Sparkles,
  Sprout,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { formatTime } from "~/components/game/actions/format";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { Fact, StatRow } from "~/components/game/expeditions/parts";
import type { ItemRarity } from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import type { Duration, Location, Modifiers, Resource } from "./types";

type Found = Extract<Resource, { unlocked: true }>;

/** Average number found over one expedition, as the claim rolls it. */
function expectedQuantity(resource: Found, duration: Duration) {
  return (
    duration.rewardRolls *
    resource.findChance *
    Math.max(1, resource.averageQuantity * duration.quantityScale)
  );
}

/** Chance of finding at least one over one expedition. */
function chanceOfAny(resource: Found, duration: Duration) {
  return 1 - (1 - resource.findChance) ** duration.rewardRolls;
}

const rarityLabel = (rarity: ItemRarity) =>
  rarity.charAt(0) + rarity.slice(1).toLowerCase();

function FindRow({
  resource,
  duration,
}: {
  resource: Resource;
  duration: Duration | null;
}) {
  if (!resource.unlocked) {
    return (
      <li className="flex items-center gap-3 rounded-[12px] bg-surface-inset/40 p-2 pr-3 opacity-60">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-black/20 text-muted-foreground">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-muted-foreground">
            Undiscovered
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Gathering {resource.requiredGatheringLevel}
          </span>
        </span>
      </li>
    );
  }

  const expected =
    duration && resource.findChance > 0
      ? expectedQuantity(resource, duration)
      : null;
  return (
    <li className="flex items-center gap-3 rounded-[12px] bg-surface-inset/50 p-2 pr-3">
      <ItemArtwork
        src={resource.sprite}
        name={resource.name}
        rarity={resource.rarity}
        size={48}
        itemId={resource.itemId}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {resource.name}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {rarityLabel(resource.rarity)}
        </span>
      </span>
      {expected !== null && duration ? (
        expected >= 1 ? (
          <span
            className="shrink-0 rounded-[7px] bg-secondary/60 px-2 py-0.5 text-xs font-semibold tabular-nums"
            title={`About ${Math.round(expected)} per ${duration.label} expedition`}
          >
            ≈ {Math.round(expected).toLocaleString()}
          </span>
        ) : (
          <span
            className="shrink-0 rounded-[7px] bg-primary/[0.12] px-2 py-0.5 text-xs font-semibold tabular-nums text-primary"
            title={`Chance to find any in a ${duration.label} expedition`}
          >
            {Math.max(1, Math.round(chanceOfAny(resource, duration) * 100))}%
          </span>
        )
      ) : null}
    </li>
  );
}

function GathererStats({ modifiers }: { modifiers: Modifiers }) {
  const effect = modifiers.sources.activeEffect;
  const signed = (value: number, unit = "") =>
    `${value >= 0 ? "+" : ""}${Number(value.toFixed(1))}${unit}`;

  return (
    <section
      aria-labelledby="gatherer-stats-title"
      className="game-panel-flat p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="gatherer-stats-title" className="text-sm font-semibold">
          Your gatherer
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/inventory">Change gear</Link>
        </Button>
      </div>
      <dl className="grid gap-1.5 sm:grid-cols-2 sm:gap-x-3">
        <StatRow icon={Clover} label="Luck" value={signed(modifiers.luck)} />
        <StatRow
          icon={Sprout}
          label="Gathering efficiency"
          value={signed(modifiers.gatheringEfficiency, "%")}
        />
        <StatRow
          icon={Search}
          label="Find chance"
          value={signed(modifiers.findBonusPercent, "%")}
        />
        <StatRow
          icon={Layers}
          label="Yield"
          value={signed(modifiers.quantityBonusPercent, "%")}
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

export function GatheringPlanner(props: {
  location: Location;
  skillLevel: number;
  durations: Duration[];
  duration: Duration | null;
  onSelectDuration: (id: number) => void;
  modifiers: Modifiers;
  now: number;
  starting: boolean;
  onStart: () => void;
}) {
  const { location, duration } = props;
  const found = location.resources.filter(
    (resource): resource is Found => resource.unlocked,
  );
  const findable = found.filter((resource) => resource.findChance > 0);
  const haul = duration
    ? findable.reduce(
        (sum, resource) => sum + expectedQuantity(resource, duration),
        0,
      )
    : 0;
  const blocker = !location.unlocked
    ? props.skillLevel < location.requiredGatheringLevel
      ? `Requires Gathering ${location.requiredGatheringLevel}.`
      : `Requires character level ${location.requiredLevel}.`
    : !duration
      ? "No expedition length is open at your Gathering level yet."
      : findable.length === 0
        ? "Nothing here can be gathered at your Gathering level yet."
        : null;

  return (
    <div className="space-y-6">
      <article className="game-panel-flat relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(70%_100%_at_0%_0%,hsl(var(--primary)/0.08),transparent_70%)]"
        />
        <div className="space-y-6 p-5 sm:p-6">
          <section aria-labelledby="gathering-finds-title">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="gathering-finds-title" className="text-sm font-semibold">
                Finds
              </h2>
              {location.resources.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {found.length} of {location.resources.length} discovered
                </span>
              ) : null}
            </div>
            {location.resources.length === 0 ? (
              <p className="rounded-[12px] bg-surface-inset/50 p-4 text-sm text-muted-foreground">
                Nothing grows here right now.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {location.resources.map((resource, index) => (
                  <FindRow
                    key={
                      resource.unlocked
                        ? resource.id
                        : `locked-${resource.requiredGatheringLevel}-${index}`
                    }
                    resource={resource}
                    duration={duration}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="gathering-length-title">
            <h3
              id="gathering-length-title"
              className="mb-3 text-sm font-semibold"
            >
              Time away
            </h3>
            {props.durations.length === 0 ? (
              <p className="rounded-[12px] bg-surface-inset/50 p-4 text-sm text-muted-foreground">
                No expedition lengths are open.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="gathering-length-title"
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
                          <LockKeyhole
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                        {row.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                        {row.unlocked
                          ? `+${row.xpReward.toLocaleString()} XP`
                          : `Gathering ${row.requiredGatheringLevel}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <dl className="grid grid-cols-3 gap-2">
            <Fact
              icon={Search}
              label="Searches"
              value={duration ? String(duration.rewardRolls) : "—"}
            />
            <Fact
              icon={Sparkles}
              label="Experience"
              value={
                duration ? `+${duration.xpReward.toLocaleString()} XP` : "—"
              }
              tone="text-xp"
            />
            <Fact
              icon={Package}
              label="Items"
              value={
                duration && findable.length > 0
                  ? `≈ ${Math.max(1, Math.round(haul)).toLocaleString()}`
                  : "—"
              }
            />
          </dl>
        </div>

        <footer className="flex flex-col gap-3 bg-surface-inset/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p
            className={cn(
              "flex items-center gap-2 text-xs leading-relaxed",
              blocker ? "text-warning" : "text-muted-foreground",
            )}
          >
            {blocker ? (
              <>
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {blocker}
              </>
            ) : duration ? (
              <>
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Back at{" "}
                {formatTime(
                  new Date(
                    props.now + duration.durationSeconds * 1_000,
                  ).toISOString(),
                )}
              </>
            ) : null}
          </p>
          <Button
            className="shrink-0 sm:min-w-[184px]"
            disabled={Boolean(blocker) || props.starting}
            onClick={props.onStart}
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            {props.starting ? "Preparing…" : "Begin gathering"}
          </Button>
        </footer>
      </article>

      <GathererStats modifiers={props.modifiers} />
    </div>
  );
}
