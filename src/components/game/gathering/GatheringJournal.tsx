import { Leaf } from "lucide-react";
import { formatLength } from "~/components/game/actions/format";
import { JournalDialog, LootGrid } from "~/components/game/expeditions/parts";
import type { JournalEntry } from "./types";

const itemCount = (entry: JournalEntry) =>
  entry.rewards.reduce((sum, reward) => sum + reward.quantity, 0);

export function GatheringJournal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: JournalEntry[];
  now: number;
}) {
  const items = props.entries.reduce((sum, entry) => sum + itemCount(entry), 0);
  const xp = props.entries.reduce((sum, entry) => sum + entry.xpReward, 0);

  return (
    <JournalDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      now={props.now}
      eyebrow="Expedition journal"
      title="Your last expeditions"
      summary={
        props.entries.length > 0
          ? `${props.entries.length} ${props.entries.length === 1 ? "expedition" : "expeditions"} · ${items.toLocaleString()} items · +${xp.toLocaleString()} XP earned`
          : "Your last six expeditions are written here."
      }
      emptyText="No expeditions yet."
      rows={props.entries.map((entry) => {
        const count = itemCount(entry);
        return {
          id: entry.id,
          good: true,
          icon: Leaf,
          title: entry.location.name,
          status: "Returned",
          note: `${count.toLocaleString()} ${count === 1 ? "item" : "items"}`,
          claimedAt: entry.claimedAt,
          rewards: entry.rewards,
          xpLabel: `+${entry.xpReward.toLocaleString()} XP`,
          body: (
            <>
              <LootGrid
                title="Haul"
                rewards={entry.rewards}
                emptyText="Nothing worth bringing home."
              />
              <p className="text-[11px] text-muted-foreground">
                {formatLength(entry.durationSeconds)} expedition ·{" "}
                {new Date(entry.claimedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </>
          ),
        };
      })}
    />
  );
}
