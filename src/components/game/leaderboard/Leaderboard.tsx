"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { Check, Info, UserPlus } from "lucide-react";
import { openFriends } from "~/components/game/friends/openFriends";
import { getSkillIcon } from "~/components/game/ui/Sidebars/navigation-links";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  DEFAULT_LEADERBOARD_BOARD,
  LEADERBOARD_REFRESH_MS,
  LEADERBOARD_SCOPES,
  LEADERBOARD_VIEWS,
  readLeaderboardScope,
  readLeaderboardView,
  type LeaderboardBoard,
  type LeaderboardRow,
  type LeaderboardScope,
  type LeaderboardView,
} from "~/game/leaderboard";
import { cn } from "~/lib/utils";

/** Borderless inset well, like the marketplace's filter toolbar. */
const controlClass =
  "flex h-9 w-auto min-w-0 items-center justify-start gap-2 whitespace-nowrap rounded-[9px] border-0 bg-surface-inset px-3 text-[13px] text-foreground shadow-none transition-colors hover:bg-secondary/70 focus:outline-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring/80 data-[state=open]:bg-secondary/70";
// `shadow-[var(...)]` compiles to a shadow *colour*, so the overlay shadow is
// set as a plain property.
const overlayClass = "rounded-[12px] border-0 [box-shadow:var(--shadow-overlay)]";
const menuItemClass = "rounded-[8px] text-[13px] [&_svg]:text-primary";

const BOARD_GROUPS = ["Character", "Skills", "More"] as const;
const REFRESH_HOURS = LEADERBOARD_REFRESH_MS / 3_600_000;
// A fixed locale: the ranks are also rendered on the server.
const integer = new Intl.NumberFormat("en-US");

function BoardIcon({ board }: { board: LeaderboardBoard }) {
  if (!board.skill) return null;
  if (board.skill.icon) {
    return (
      <Image
        src={board.skill.icon}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 shrink-0 object-contain"
      />
    );
  }
  const Icon = getSkillIcon(board.skill.name);
  return <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />;
}

/** The ranking to show: a searchable, grouped two-column picker. */
function BoardPicker({
  boards,
  selected,
  onSelect,
}: {
  boards: LeaderboardBoard[];
  selected: LeaderboardBoard;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ranking: ${selected.label}`}
          className={controlClass}
        >
          <BoardIcon board={selected} />
          <span className="truncate">{selected.label}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(overlayClass, "w-[22rem] p-0")}
      >
        <Command className="bg-transparent [&_[cmdk-input-wrapper]]:m-2 [&_[cmdk-input-wrapper]]:rounded-[9px] [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]]:bg-surface-inset">
          <CommandInput placeholder="Search…" className="h-9 text-[13px]" />
          <CommandList className="max-h-[min(26rem,60dvh)] pb-1">
            <CommandEmpty className="py-6 text-center text-[13px] text-muted-foreground">
              No ranking matches.
            </CommandEmpty>
            {BOARD_GROUPS.map((group) => {
              const items = boards.filter((board) => board.group === group);
              if (items.length === 0) return null;
              return (
                <CommandGroup
                  key={group}
                  heading={group}
                  className="px-2 py-0.5 [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-2 [&_[cmdk-group-items]]:gap-0.5"
                >
                  {items.map((board) => (
                    <CommandItem
                      key={board.key}
                      value={board.label}
                      onSelect={() => {
                        setOpen(false);
                        onSelect(board.key);
                      }}
                      className={cn(
                        "min-w-0 rounded-[8px] text-[13px]",
                        board.key === selected.key && "bg-secondary/50",
                      )}
                    >
                      <BoardIcon board={board} />
                      <span className="truncate">{board.label}</span>
                      {board.key === selected.key ? (
                        <Check
                          className="ml-auto text-primary"
                          aria-label="Selected"
                        />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Avatar({ avatar }: { avatar: LeaderboardRow["avatar"] }) {
  return (
    <span
      className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
      style={{ background: avatar.backdrop }}
    >
      <Image
        src={avatar.src}
        alt=""
        width={64}
        height={64}
        className="h-full w-full object-cover object-top"
      />
    </span>
  );
}

/**
 * The leaderboard: which ranking, which slice of it (the top, or around the
 * player), and who to compare with. Filters live in the URL; the server
 * answers from a snapshot taken every few hours.
 */
export function Leaderboard({
  boards,
  board,
  view,
  scope,
  rows,
  viewerRank,
  noFriends,
  updatedAgo,
}: {
  boards: LeaderboardBoard[];
  board: LeaderboardBoard;
  view: LeaderboardView;
  scope: LeaderboardScope;
  rows: LeaderboardRow[];
  viewerRank: number | null;
  /** The Friends filter is on and the viewer has none. */
  noFriends: boolean;
  /** "3 h ago", formatted on the server. */
  updatedAgo: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // The pickers show a choice at once; the rows follow when the server answers.
  const [choice, setChoice] = useState({ board: board.key, view, scope });
  useEffect(
    () => setChoice({ board: board.key, view, scope }),
    [board.key, view, scope],
  );

  const navigate = (next: {
    board: string;
    view: LeaderboardView;
    scope: LeaderboardScope;
  }) => {
    setChoice(next);
    const params = new URLSearchParams();
    if (next.board !== DEFAULT_LEADERBOARD_BOARD) params.set("board", next.board);
    if (next.view !== "you") params.set("view", next.view);
    if (next.scope !== "everyone") params.set("players", next.scope);
    const query = params.toString();
    startTransition(() =>
      router.replace(query ? `/leaderboard?${query}` : "/leaderboard", {
        scroll: false,
      }),
    );
  };

  const selected = boards.find((item) => item.key === choice.board) ?? board;
  // The Total Level board already ranks by it.
  const showTotal = board.key !== "total";

  return (
    <section aria-labelledby="leaderboard-heading" className="space-y-3">
      <h2 id="leaderboard-heading" className="sr-only">
        {board.label} ranking
      </h2>
      <div className="flex flex-wrap gap-2">
        <BoardPicker
          boards={boards}
          selected={selected}
          onSelect={(key) => navigate({ ...choice, board: key })}
        />
        <Select
          value={choice.view}
          onValueChange={(value) =>
            navigate({ ...choice, view: readLeaderboardView(value) })
          }
        >
          <SelectTrigger aria-label="Rows" className={controlClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={overlayClass}>
            {LEADERBOARD_VIEWS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className={menuItemClass}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={choice.scope}
          onValueChange={(value) =>
            navigate({ ...choice, scope: readLeaderboardScope(value) })
          }
        >
          <SelectTrigger aria-label="Players" className={controlClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={overlayClass}>
            {LEADERBOARD_SCOPES.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className={menuItemClass}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {noFriends ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-inset/60 px-4 py-2 text-[13px] text-text-secondary">
          <p>You have no friends yet.</p>
          <Button type="button" size="sm" variant="soft" onClick={openFriends}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Find friends
          </Button>
        </div>
      ) : null}

      {view === "you" && viewerRank === null ? (
        <p className="rounded-[10px] bg-surface-inset/60 px-4 py-2.5 text-[13px] text-text-secondary">
          You&rsquo;re not ranked yet.
        </p>
      ) : null}

      <div
        aria-busy={isPending}
        className={cn(
          "game-panel-flat overflow-hidden transition-opacity",
          isPending && "opacity-60",
        )}
      >
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="bg-surface-inset/50 text-left text-[12px] text-text-secondary">
              <th
                scope="col"
                className="w-[4.5rem] py-3 pl-3 pr-1 font-semibold sm:w-24 sm:pl-4 sm:pr-2"
              >
                #
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Name
              </th>
              {showTotal ? (
                <th
                  scope="col"
                  className="hidden w-1/4 px-2 py-3 font-semibold sm:table-cell"
                >
                  Total Level
                </th>
              ) : null}
              <th
                scope="col"
                className="w-[7.5rem] py-3 pl-2 pr-3 text-right font-semibold sm:w-1/4 sm:pr-4"
              >
                {board.column}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.rank}
                aria-current={row.isViewer ? "true" : undefined}
                className={
                  row.isViewer ? "bg-primary/10" : "even:bg-surface-inset/30"
                }
              >
                <td
                  className={cn(
                    "py-2 pl-3 pr-1 tabular-nums sm:pl-4 sm:pr-2",
                    row.isViewer
                      ? "font-semibold text-primary"
                      : "text-text-secondary",
                  )}
                >
                  #{integer.format(row.rank)}
                </td>
                <td className="px-2 py-2">
                  <Link
                    href={row.href}
                    className="flex min-w-0 items-center gap-3 font-semibold text-foreground hover:text-primary"
                  >
                    <Avatar avatar={row.avatar} />
                    <span className="truncate">{row.name}</span>
                  </Link>
                </td>
                {showTotal ? (
                  <td className="hidden px-2 py-2 tabular-nums text-text-secondary sm:table-cell">
                    Lv {integer.format(row.totalLevel)}
                  </td>
                ) : null}
                <td className="py-2 pl-2 pr-3 text-right font-semibold tabular-nums sm:pr-4">
                  Lv {integer.format(row.level)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-surface-inset/50 px-4 py-3 text-[13px] text-text-secondary">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>This leaderboard is updated every {REFRESH_HOURS} hours</span>
        <span className="ml-auto text-muted-foreground">
          Last update {updatedAgo}
        </span>
      </p>
    </section>
  );
}
