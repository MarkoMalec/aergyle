import Image from "next/image";
import Link from "next/link";
import { Castle, Check } from "lucide-react";
import type React from "react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import {
  QUEST_OBJECTIVE_LABELS,
  QUEST_REPEAT_LABELS,
  type QuestMarkerKind,
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

const MARKERS: Record<
  QuestMarkerKind,
  { glyph: "!" | "?" | null; label: string; color: string; lit: boolean }
> = {
  ready: {
    glyph: "?",
    label: "Ready to hand in",
    color: "var(--success)",
    lit: true,
  },
  available: {
    glyph: "!",
    label: "Quest available",
    color: "var(--currency)",
    lit: true,
  },
  repeatable: {
    glyph: "!",
    label: "Daily or weekly quest available",
    color: "var(--info)",
    lit: true,
  },
  active: {
    glyph: "?",
    label: "In progress",
    color: "var(--muted-foreground)",
    lit: false,
  },
  completed: {
    glyph: null,
    label: "Completed",
    color: "var(--muted-foreground)",
    lit: false,
  },
};

const OUTLINE = "hsl(var(--background))";
const QUESTION = "M6.5 11 C6.5 3 17.5 3 17.5 10.5 C17.5 16 12 16.5 12 22.5";

/** "!" or "?" as a shape with a dark outline, so it reads on any artwork. */
function QuestGlyph(props: { glyph: "!" | "?"; fill: string; height: number }) {
  return (
    <svg
      viewBox="0 0 24 40"
      width={props.height * 0.6}
      height={props.height}
      aria-hidden="true"
      className="overflow-visible"
    >
      {props.glyph === "!" ? (
        <g
          fill={props.fill}
          stroke={OUTLINE}
          strokeWidth={3.5}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          <path d="M6.5 5.5 C6.5 1.5 17.5 1.5 17.5 5.5 L14.6 24.5 C14.2 27.5 9.8 27.5 9.4 24.5 Z" />
          <circle cx="12" cy="34" r="4.6" />
        </g>
      ) : (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={QUESTION} stroke={OUTLINE} strokeWidth={10.5} />
          <path d={QUESTION} stroke={props.fill} strokeWidth={6} />
          <circle
            cx="12"
            cy="33.5"
            r="4.6"
            fill={props.fill}
            stroke={OUTLINE}
            strokeWidth={3.5}
            paintOrder="stroke"
          />
        </g>
      )}
    </svg>
  );
}

/**
 * The classic quest-giver mark: "!" to take a quest, "?" once it's under way.
 * With `burst`, rays of light turn slowly behind it; with `pulse`, a glow
 * keeps pinging out of it.
 */
export function QuestMarker({
  kind,
  size = 22,
  burst = false,
  pulse = false,
  label,
  className,
}: {
  kind: QuestMarkerKind;
  /** The glyph's height in pixels. */
  size?: number;
  burst?: boolean;
  pulse?: boolean;
  /** Replaces the kind's own label, e.g. to say the quests are new. */
  label?: string;
  className?: string;
}) {
  const marker = MARKERS[kind];
  const color = (alpha = 1) => `hsl(${marker.color} / ${alpha})`;
  const rays = burst && marker.lit;
  const box = Math.round(rays ? size * 1.8 : size);
  const glow = Math.max(3, Math.round(size / 5));

  return (
    <span
      role="img"
      aria-label={label ?? marker.label}
      title={label ?? marker.label}
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: box, height: box }}
    >
      {rays ? (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle,hsl(var(--background)/0.7)_25%,transparent_70%)]"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full [mask-image:radial-gradient(circle,#000_20%,transparent_70%)] motion-safe:animate-[spin_14s_linear_infinite]"
            style={{
              background: `repeating-conic-gradient(${color()} 0deg 7deg, transparent 7deg 30deg)`,
            }}
          />
        </>
      ) : null}
      {pulse ? (
        <span
          aria-hidden="true"
          className="absolute rounded-full blur-[2px] motion-safe:animate-ping"
          style={{
            inset: (box - size * 0.9) / 2,
            background: color(0.55),
          }}
        />
      ) : null}
      <span
        className="relative grid place-items-center"
        style={{
          filter: marker.lit
            ? `drop-shadow(0 2px 3px rgb(0 0 0 / 0.45)) drop-shadow(0 0 ${glow}px ${color(0.75)})`
            : "drop-shadow(0 2px 3px rgb(0 0 0 / 0.45))",
        }}
      >
        {marker.glyph ? (
          <QuestGlyph glyph={marker.glyph} fill={color()} height={size} />
        ) : (
          <Check
            aria-hidden="true"
            strokeWidth={3}
            style={{ color: color(), width: size * 0.8, height: size * 0.8 }}
          />
        )}
      </span>
    </span>
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
