import { Skull, Trophy } from "lucide-react";
import { formatLength } from "~/components/game/actions/format";
import {
  EncounterRow,
  JournalDialog,
  JournalStat,
  LootGrid,
} from "~/components/game/expeditions/parts";
import type { JournalEntry } from "./types";

function JournalRun({ entry }: { entry: JournalEntry }) {
  const { report, rewards } = entry;
  const defeated = report.outcome === "DEFEATED";
  const totalDamage = report.encounters.reduce(
    (sum, row) => sum + row.damageTaken,
    0,
  );

  return (
    <>
      {defeated ? (
        <p className="rounded-[10px] bg-danger/10 px-3 py-2.5 text-sm">
          <strong className="font-semibold text-danger">
            {report.defeatedBy
              ? `${report.defeatedBy.name} overwhelmed you.`
              : "The dungeon overwhelmed you."}
          </strong>{" "}
          <span className="text-text-secondary">
            {rewards.length > 0
              ? "You crawled out with the scraps below."
              : "You crawled out empty-handed."}
          </span>
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <JournalStat
          label="Health lost"
          value={Math.round(report.damageTaken).toLocaleString()}
          tone={report.damageTaken > 0 ? "text-danger" : "text-success"}
        />
        <JournalStat
          label="Health after"
          value={
            report.health
              ? `${Math.floor(report.health.after)} / ${Math.floor(report.health.max)}`
              : "—"
          }
          tone={defeated ? "text-danger" : undefined}
        />
        <JournalStat
          label="Evaded · blocked"
          value={`${report.evaded} · ${report.blocked}`}
        />
        <JournalStat
          label="Critical hits"
          value={String(report.criticalHits)}
        />
      </dl>

      {report.encounters.length > 0 ? (
        <section aria-label="Monsters faced">
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
            Monsters faced
          </h4>
          <ul className="space-y-1.5">
            {report.encounters.map((encounter) => (
              <EncounterRow
                key={encounter.creatureId}
                asset={encounter.asset}
                name={encounter.name}
                tag={
                  report.defeatedBy?.creatureId === encounter.creatureId ? (
                    <span className="ml-2 font-normal text-danger">
                      Final blow
                    </span>
                  ) : null
                }
                detail={`${Math.round(encounter.damageTaken).toLocaleString()} damage`}
                damage={encounter.damageTaken}
                totalDamage={totalDamage}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <LootGrid
        title={defeated ? "Scraps kept" : "Loot"}
        rewards={rewards}
        emptyText={
          defeated
            ? "Nothing made it out with you."
            : "The monsters carried nothing worth keeping."
        }
      />

      <p className="text-[11px] text-muted-foreground">
        {formatLength(entry.durationSeconds)} run ·{" "}
        {new Date(entry.claimedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </>
  );
}

export function DungeonJournal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: JournalEntry[];
  now: number;
}) {
  const cleared = props.entries.filter(
    (entry) => entry.report.outcome === "CLEARED",
  ).length;
  const xp = props.entries.reduce(
    (sum, entry) => sum + (entry.report.xp ?? 0),
    0,
  );

  return (
    <JournalDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      now={props.now}
      eyebrow="Dungeon journal"
      title="Your last runs"
      summary={
        props.entries.length > 0
          ? `${cleared} cleared · ${props.entries.length - cleared} lost · +${xp.toLocaleString()} XP earned`
          : "Your last six runs are written here."
      }
      emptyText="No runs yet. Clear a dungeon, or fall in one, and it is written here."
      rows={props.entries.map((entry) => {
        const good = entry.report.outcome === "CLEARED";
        return {
          id: entry.id,
          good,
          icon: good ? Trophy : Skull,
          title: entry.dungeon.name,
          status: good ? "Cleared" : "Defeated",
          claimedAt: entry.claimedAt,
          rewards: entry.rewards,
          xpLabel: good
            ? `+${(entry.report.xp ?? 0).toLocaleString()} XP`
            : "No XP",
          body: <JournalRun entry={entry} />,
        };
      })}
    />
  );
}
