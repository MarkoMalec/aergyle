import { Castle, DoorOpen, MapPin, PackageOpen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ActiveExpeditionCard } from "~/components/game/expeditions/parts";
import { DifficultyPill } from "./shared";
import type { DungeonMonster, Run } from "./types";

export function DungeonActiveRun(props: {
  run: Run;
  now: number;
  /** The dungeon's inhabitants, when it is at the current location. */
  monsters: DungeonMonster[];
  claiming: boolean;
  leaving: boolean;
  onClaim: () => void;
  onLeave: () => void;
}) {
  const { run } = props;
  return (
    <ActiveExpeditionCard
      status={run.status}
      startedAt={run.startedAt}
      endsAt={run.endsAt}
      now={props.now}
      eyebrow={{ active: "Inside the dungeon", ready: "The fighting is over" }}
      title={run.dungeon.name}
      meta={
        <>
          <DifficultyPill difficulty={run.dungeon.difficulty} />
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {run.dungeon.location.name}
          </span>
        </>
      }
      route={{ from: DoorOpen, to: Castle, startedLabel: "Entered at" }}
      faces={props.monsters}
      facesLabel={{ active: "Fighting through", ready: "You faced" }}
      footer={(ready) =>
        ready
          ? {
              title: "Your fate has been decided.",
              text: "Loot, damage and experience are revealed together.",
              action: (
                <Button
                  className="shrink-0 sm:min-w-[184px]"
                  onClick={props.onClaim}
                  disabled={props.claiming}
                >
                  <PackageOpen className="h-4 w-4" aria-hidden="true" />
                  {props.claiming ? "Opening…" : "See what happened"}
                </Button>
              ),
            }
          : {
              title: "Leaving early is safe, but empty-handed.",
              text: "You lose no health, and you keep nothing.",
              action: (
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={props.onLeave}
                  disabled={props.leaving}
                >
                  <DoorOpen className="h-4 w-4" aria-hidden="true" />
                  {props.leaving ? "Leaving…" : "Leave dungeon"}
                </Button>
              ),
            }
      }
    />
  );
}
