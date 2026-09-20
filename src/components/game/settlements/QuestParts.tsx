import Image from "next/image";
import Link from "next/link";
import { Castle } from "lucide-react";
import type React from "react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import {
  QUEST_OBJECTIVE_LABELS,
  QUEST_REPEAT_LABELS,
} from "~/game/settlements";
import { formatGold } from "~/lib/marketplace";
import { cn } from "~/lib/utils";
import type { QuestView } from "~/server/settlements";

export function formatTimeLeft(iso: string) {
  const minutes = Math.max(
    1,
    Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000),
  );
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/** Share (0–1) of an accepted quest's objectives that is done. */
function questProgress(quest: QuestView) {
  if (quest.status === "COMPLETED" || quest.objectives.length === 0) return 1;
  return (
    quest.objectives.reduce(
      (sum, objective) => sum + objective.current / objective.quantity,
      0,
    ) / quest.objectives.length
  );
}

/** Shown once a quest is accepted. */
export function QuestProgressBar({ quest }: { quest: QuestView }) {
  if (quest.status !== "ACTIVE" && quest.status !== "COMPLETED") return null;
  const done = quest.ready || quest.status === "COMPLETED";
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-inset">
      <div
        className={cn(
          "h-full rounded-full",
          done ? "bg-success" : "bg-primary",
        )}
        style={{ width: `${Math.floor(questProgress(quest) * 100)}%` }}
      />
    </div>
  );
}

const chip = "rounded-full px-2 py-0.5 text-[11px] font-semibold";

export function QuestStatusChip({ quest }: { quest: QuestView }) {
  const [text, tone] = quest.ready
    ? ["Ready", "bg-success/15 text-success"]
    : {
        ACTIVE: ["In progress", "bg-info/15 text-info"],
        AVAILABLE: ["New", "bg-primary/15 text-primary"],
        COMPLETED: ["Completed", "bg-secondary/60 text-muted-foreground"],
      }[quest.status];
  return <span className={cn(chip, tone)}>{text}</span>;
}

export function QuestRepeatBadge({ quest }: { quest: QuestView }) {
  return (
    <span className={cn(chip, "bg-secondary/60 text-text-secondary")}>
      {QUEST_REPEAT_LABELS[quest.repeat]}
      {quest.resetsAt ? (
        <span
          className="font-normal text-muted-foreground"
          suppressHydrationWarning
        >
          {" "}
          · {formatTimeLeft(quest.resetsAt)}
        </span>
      ) : null}
    </span>
  );
}

/** Artwork for a creature or dungeon target, with a count in the corner. */
function TargetChip(props: {
  href: string | null;
  label: string;
  image: string | null;
  size: number;
  children: React.ReactNode;
}) {
  const body = (
    <span
      className="relative grid shrink-0 place-items-center rounded-xl bg-black/20"
      style={{ width: props.size, height: props.size }}
    >
      {props.image ? (
        <Image
          src={props.image}
          alt=""
          width={props.size}
          height={props.size}
          className="h-full w-full rounded-xl object-contain p-1"
        />
      ) : (
        <Castle
          className="h-1/2 w-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      )}
      <span className="game-item-quantity">{props.children}</span>
    </span>
  );
  return props.href ? (
    <Link href={props.href} aria-label={props.label}>
      {body}
    </Link>
  ) : (
    body
  );
}

/** Each objective as its artwork, with progress (or the amount) on top. */
export function QuestObjectiveChips({
  quest,
  size = 44,
}: {
  quest: QuestView;
  size?: number;
}) {
  const accepted = quest.status === "ACTIVE";
  return (
    <div className="flex flex-wrap gap-2">
      {quest.objectives.map((objective, index) => {
        const done = accepted && objective.current >= objective.quantity;
        const count = (
          <span className={cn(done && "text-success")}>
            {accepted
              ? `${objective.current}/${objective.quantity}`
              : objective.quantity}
          </span>
        );
        const label = `${QUEST_OBJECTIVE_LABELS[objective.type]} ${objective.target.name}`;
        const { target } = objective;
        return (
          <span key={index} title={label}>
            {target.itemId !== null && target.image && target.rarity ? (
              <ItemArtwork
                src={target.image}
                name={target.name}
                rarity={target.rarity}
                size={size}
                itemId={target.itemId}
                quantity={count}
              />
            ) : (
              <TargetChip
                href={target.href}
                label={label}
                image={target.image}
                size={size}
              >
                {count}
              </TargetChip>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function QuestRewards({
  rewards,
  size = 44,
}: {
  rewards: QuestView["rewards"];
  size?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {rewards.gold > 0 ? (
        <span className="flex items-center gap-1 font-semibold text-currency">
          <CoinsIcon size={18} />
          {formatGold(rewards.gold)}
        </span>
      ) : null}
      {rewards.xp > 0 ? (
        <span className="font-semibold text-xp">+{rewards.xp} XP</span>
      ) : null}
      {rewards.items.map((item) => (
        <ItemArtwork
          key={item.id}
          src={item.sprite}
          name={item.name}
          rarity={item.rarity}
          size={size}
          itemId={item.id}
          quantity={item.quantity}
        />
      ))}
    </div>
  );
}
