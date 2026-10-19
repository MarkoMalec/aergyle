import { PawPrint } from "lucide-react";
import { formatLength } from "~/components/game/actions/format";
import {
  EncounterRow,
  JournalDialog,
  JournalStat,
  LootGrid,
} from "~/components/game/expeditions/parts";
import type { JournalEntry } from "./types";

function JournalHunt({ entry }: { entry: JournalEntry }) {
  const { report } = entry;
  const animals = report.encounters.reduce((sum, row) => sum + row.count, 0);
  const attacks = report.encounters.reduce((sum, row) => sum + row.attacks, 0);
  const avoided = report.encounters.reduce(
    (sum, row) => sum + row.evaded + row.blocked,
    0,
  );
  const animalDamage = report.encounters.reduce(
    (sum, row) => sum + row.damageTaken,
    0,
  );
  const prevented = Math.max(
    0,
    Math.round((report.potentialDamage ?? 0) - report.totalDamage),
  );

  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <JournalStat label="Animals" value={String(animals)} />
        <JournalStat
          label="Blows avoided"
          value={attacks > 0 ? `${avoided} of ${attacks}` : "No attacks"}
        />
        <JournalStat
          label="Mishaps"
          value={
            report.accidents.injuries > 0
              ? `${report.accidents.injuries} · ${Math.round(report.accidents.damageTaken)} dmg`
              : "None"
          }
          tone={report.accidents.injuries > 0 ? "text-warning" : undefined}
        />
        <JournalStat
          label="Health lost"
          value={Math.round(report.totalDamage).toLocaleString()}
          tone={report.totalDamage > 0 ? "text-danger" : "text-success"}
        />
      </dl>
      {prevented > 0 ? (
        <p className="text-xs text-muted-foreground">
          The safety cap spared you {prevented.toLocaleString()} more damage.
        </p>
      ) : null}

      {report.encounters.length > 0 ? (
        <section aria-label="Animals tracked">
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
            Animals tracked
          </h4>
          <ul className="space-y-1.5">
            {report.encounters.map((encounter) => (
              <EncounterRow
                key={encounter.creatureId}
                asset={encounter.asset}
                name={encounter.name}
                tag={
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ×{encounter.count}
                  </span>
                }
                detail={
                  encounter.attacks > 0
                    ? `${encounter.attacks} ${encounter.attacks === 1 ? "attack" : "attacks"} · ${Math.round(encounter.damageTaken)} damage`
                    : "No attacks"
                }
                damage={encounter.damageTaken}
                totalDamage={animalDamage}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <LootGrid
        title="Materials"
        rewards={entry.rewards}
        emptyText="Nothing worth bringing home."
      />

      <p className="text-[11px] text-muted-foreground">
        {formatLength(entry.durationSeconds)} hunt
        {report.health
          ? ` · ${Math.floor(report.health.after)} / ${Math.floor(report.health.max)} health after`
          : ""}{" "}
        ·{" "}
        {new Date(entry.claimedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </>
  );
}

export function HuntingJournal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: JournalEntry[];
  now: number;
}) {
  const animals = props.entries.reduce(
    (sum, entry) =>
      sum +
      entry.report.encounters.reduce((total, row) => total + row.count, 0),
    0,
  );
  const xp = props.entries.reduce((sum, entry) => sum + entry.xpReward, 0);

  return (
    <JournalDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      now={props.now}
      eyebrow="Hunt journal"
      title="Your last hunts"
      summary={
        props.entries.length > 0
          ? `${props.entries.length} ${props.entries.length === 1 ? "hunt" : "hunts"} · ${animals} animals · +${xp.toLocaleString()} XP earned`
          : "Your last six hunts are written here."
      }
      emptyText="No hunts yet. Come back from one and it is written here."
      rows={props.entries.map((entry) => ({
        id: entry.id,
        good: true,
        icon: PawPrint,
        title: entry.ground.name,
        status: "Returned",
        note:
          entry.report.totalDamage > 0
            ? `${Math.round(entry.report.totalDamage)} damage`
            : "unhurt",
        claimedAt: entry.claimedAt,
        rewards: entry.rewards,
        xpLabel: `+${entry.xpReward.toLocaleString()} XP`,
        body: <JournalHunt entry={entry} />,
      }))}
    />
  );
}
