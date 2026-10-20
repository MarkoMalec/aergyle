"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AtSign,
  Check,
  MessageSquare,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { timeAgo } from "~/game/communication";
import { readFriendSearchTerm, type FriendRelation } from "~/game/friends";
import { isOnline, playerProfileHref } from "~/game/players";
import {
  DEFAULT_PLAYER_AVATAR,
  getPlayerAvatarBySrc,
} from "~/lib/player-avatars";
import { cn } from "~/lib/utils";
import type { PlayerRef } from "~/server/communication";
import type {
  FriendPlayer,
  FriendRequestView,
  FriendView,
} from "~/server/players";
import { useFriendAction, useFriendSearch, useFriendsList } from "./useFriends";

export type FriendsTab = "friends" | "requests";

const rowClass =
  "flex min-h-[52px] items-center gap-3 rounded-[8px] bg-secondary/20 px-3 py-2";
const iconButtonClass =
  "grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50";
const actionClass = "h-8 gap-1.5 px-2.5 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5";

/**
 * The Friends window behind the sidebar's Friends button: the player's
 * friends with their online state, a name-tag search to add more, and the
 * requests waiting either way.
 */
export function FriendsDialog({
  tab,
  onTabChange,
  onClose,
  onNavigate,
  onMessage,
}: {
  /** The open tab, or null while the window is closed. */
  tab: FriendsTab | null;
  onTabChange: (tab: FriendsTab) => void;
  onClose: () => void;
  /** Closes the window and, on phones, the sidebar behind it. */
  onNavigate: () => void;
  /** Closes the window and starts a message to this friend. */
  onMessage: (player: PlayerRef & { id: string }) => void;
}) {
  const list = useFriendsList(tab !== null);
  const incoming = list.data?.incoming.length ?? 0;

  return (
    <Dialog open={tab !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md gap-3 border-0 p-0 outline-none focus-visible:outline-none"
        // Focus the window itself, not the first tab (no stray focus ring,
        // and no keyboard popping up on phones).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <div className="flex items-center gap-2 px-4 pt-4">
          <Users size={15} className="text-primary" aria-hidden="true" />
          <DialogTitle className="text-sm font-semibold">Friends</DialogTitle>
        </div>
        <DialogDescription className="sr-only">
          Your friends, friend requests and a search for players by name tag.
        </DialogDescription>

        <div className="flex items-center gap-2 px-4">
          <div
            role="tablist"
            aria-label="Friends"
            className="flex gap-1 rounded-[10px] bg-surface-inset/70 p-1"
          >
            <TabButton
              active={tab === "friends"}
              onClick={() => onTabChange("friends")}
            >
              Friends
            </TabButton>
            <TabButton
              active={tab === "requests"}
              onClick={() => onTabChange("requests")}
            >
              Requests
              {incoming > 0 ? (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
                  {incoming}
                </span>
              ) : null}
            </TabButton>
          </div>
          {list.data ? (
            <span className="ml-auto rounded-[8px] bg-secondary/40 px-2 py-1 text-[11px] tabular-nums text-muted-foreground">
              {list.data.friends.length}/{list.data.limit} friends
            </span>
          ) : null}
        </div>

        <div className="px-4 pb-4">
          {tab === "requests" ? (
            <RequestsTab list={list} onNavigate={onNavigate} />
          ) : (
            <FriendsTabPanel
              list={list}
              onNavigate={onNavigate}
              onMessage={onMessage}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-semibold transition-colors",
        active
          ? "bg-secondary text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

type ListQuery = ReturnType<typeof useFriendsList>;

/** The search box on top; below it the results, or else the friends. */
function FriendsTabPanel({
  list,
  onNavigate,
  onMessage,
}: {
  list: ListQuery;
  onNavigate: () => void;
  onMessage: (player: PlayerRef & { id: string }) => void;
}) {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const search = useFriendSearch(submitted);

  return (
    <div className="grid min-h-0 gap-3">
      <SearchForm
        busy={search.isFetching}
        onSearch={(term) =>
          term === submitted ? void search.refetch() : setSubmitted(term)
        }
      />
      <div className="max-h-[52vh] min-h-0 overflow-y-auto pr-1">
        {submitted !== null ? (
          <SearchResults
            term={submitted}
            search={search}
            onClear={() => setSubmitted(null)}
            onNavigate={onNavigate}
          />
        ) : list.isError ? (
          <Empty>Couldn&apos;t load your friends.</Empty>
        ) : !list.data ? (
          <RowSkeletons />
        ) : list.data.friends.length === 0 ? (
          <Empty icon>No friends yet.</Empty>
        ) : (
          <ul className="grid gap-1">
            {list.data.friends.map((friend) => (
              <FriendRow
                key={friend.id}
                friend={friend}
                onNavigate={onNavigate}
                onMessage={onMessage}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Searches only when the button is pressed (or Enter), never while typing. */
function SearchForm({
  busy,
  onSearch,
}: {
  busy: boolean;
  onSearch: (term: string) => void;
}) {
  const [value, setValue] = useState("");
  const term = readFriendSearchTerm(value);

  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (term) onSearch(term);
      }}
    >
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Name tag</span>
        <AtSign
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Name tag"
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          className="h-9 border-0 bg-surface-inset pl-8 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-ring/80"
        />
      </label>
      <Button
        type="submit"
        variant="soft"
        disabled={!term || busy}
        className="h-9 gap-1.5 px-3 text-[13px]"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        Search
      </Button>
    </form>
  );
}

function SearchResults({
  term,
  search,
  onClear,
  onNavigate,
}: {
  term: string;
  search: ReturnType<typeof useFriendSearch>;
  onClear: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="min-w-0 truncate text-[12px] text-muted-foreground">
          Results for <span className="text-foreground">@{term}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="flex h-7 shrink-0 items-center gap-1 rounded-[8px] px-2 text-[12px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      </div>
      {search.isError ? (
        <Empty>{search.error.message}</Empty>
      ) : !search.data ? (
        <RowSkeletons />
      ) : search.data.players.length === 0 ? (
        <Empty>No players found.</Empty>
      ) : (
        <ul className="grid gap-1">
          {search.data.players.map((player) => (
            <li key={player.id} className={rowClass}>
              <PlayerSummary
                player={player}
                detail={`Lv ${player.level}`}
                onNavigate={onNavigate}
              />
              <RelationActions player={player} relation={player.relation} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A friend: presence and where they are, with Message and Remove. */
function FriendRow({
  friend,
  onNavigate,
  onMessage,
}: {
  friend: FriendView;
  onNavigate: () => void;
  onMessage: (player: PlayerRef & { id: string }) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const action = useFriendAction();
  const online = isOnline(friend.lastOnline);

  if (confirming) {
    return (
      <li className={cn(rowClass, "bg-destructive/10")}>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          Remove <strong className="font-semibold">{friend.name}</strong> from
          your friends?
        </span>
        <Button
          size="sm"
          variant="ghost"
          className={actionClass}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className={actionClass}
          disabled={action.isPending}
          onClick={() =>
            action.mutate({ kind: "end", player: friend, expect: "friends" })
          }
        >
          Remove
        </Button>
      </li>
    );
  }

  return (
    <li className={rowClass}>
      <PlayerSummary
        player={friend}
        online={online}
        detail={
          online ? (
            <span className="text-success">
              Online
              {friend.location ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {friend.location}
                </span>
              ) : null}
            </span>
          ) : (
            `Last seen ${timeAgo(friend.lastOnline).toLowerCase()}`
          )
        }
        onNavigate={onNavigate}
      />
      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-text-secondary">
        Lv {friend.level}
      </span>
      <button
        type="button"
        className={iconButtonClass}
        title={`Message ${friend.name}`}
        onClick={() =>
          onMessage({ id: friend.id, name: friend.name, image: friend.image })
        }
      >
        <MessageSquare size={15} aria-hidden="true" />
        <span className="sr-only">{`Message ${friend.name}`}</span>
      </button>
      <button
        type="button"
        className={cn(iconButtonClass, "hover:text-destructive")}
        title={`Remove ${friend.name}`}
        onClick={() => setConfirming(true)}
      >
        <UserMinus size={15} aria-hidden="true" />
        <span className="sr-only">{`Remove ${friend.name} from your friends`}</span>
      </button>
    </li>
  );
}

/** Requests waiting for the player's answer, and the ones they sent. */
function RequestsTab({
  list,
  onNavigate,
}: {
  list: ListQuery;
  onNavigate: () => void;
}) {
  if (list.isError) return <Empty>Couldn&apos;t load your requests.</Empty>;
  if (!list.data) return <RowSkeletons />;
  const { incoming, outgoing, pendingLimit } = list.data;
  if (incoming.length === 0 && outgoing.length === 0) {
    return <Empty icon>No open requests.</Empty>;
  }

  return (
    <div className="grid max-h-[60vh] min-h-0 gap-4 overflow-y-auto pr-1">
      {incoming.length > 0 ? (
        <RequestSection
          title="Received"
          count={`${incoming.length}`}
          requests={incoming}
          relation="incoming"
          onNavigate={onNavigate}
        />
      ) : null}
      {outgoing.length > 0 ? (
        <RequestSection
          title="Sent"
          count={`${outgoing.length}/${pendingLimit}`}
          requests={outgoing}
          relation="outgoing"
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  );
}

function RequestSection({
  title,
  count,
  requests,
  relation,
  onNavigate,
}: {
  title: string;
  count: string;
  requests: FriendRequestView[];
  relation: "incoming" | "outgoing";
  onNavigate: () => void;
}) {
  return (
    <section className="grid gap-1.5">
      <h3 className="flex items-center justify-between px-1">
        <span className="game-eyebrow">{title}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </h3>
      <ul className="grid gap-1">
        {requests.map((request) => (
          <li key={request.player.id} className={rowClass}>
            <PlayerSummary
              player={request.player}
              detail={`Lv ${request.player.level} · ${timeAgo(request.createdAt)}`}
              onNavigate={onNavigate}
            />
            <RelationActions player={request.player} relation={relation} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What can be done with a player from here, given where the two stand. */
function RelationActions({
  player,
  relation,
}: {
  player: FriendPlayer;
  relation: FriendRelation;
}) {
  const action = useFriendAction();
  const busy = action.isPending;

  if (relation === "friends") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Friends
      </span>
    );
  }
  if (relation === "incoming") {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="soft"
          className={actionClass}
          disabled={busy}
          onClick={() => action.mutate({ kind: "add", player })}
        >
          <Check aria-hidden="true" />
          Accept
        </Button>
        <button
          type="button"
          className={cn(iconButtonClass, "hover:text-destructive")}
          title="Decline"
          disabled={busy}
          onClick={() =>
            action.mutate({ kind: "end", player, expect: "incoming" })
          }
        >
          <X size={15} aria-hidden="true" />
          <span className="sr-only">{`Decline ${player.name}'s request`}</span>
        </button>
      </span>
    );
  }
  if (relation === "outgoing") {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <span className="text-[12px] text-muted-foreground">Requested</span>
        <button
          type="button"
          className={cn(iconButtonClass, "hover:text-destructive")}
          title="Cancel request"
          disabled={busy}
          onClick={() =>
            action.mutate({ kind: "end", player, expect: "outgoing" })
          }
        >
          <X size={15} aria-hidden="true" />
          <span className="sr-only">{`Cancel your request to ${player.name}`}</span>
        </button>
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="soft"
      className={cn(actionClass, "shrink-0")}
      disabled={busy}
      onClick={() => action.mutate({ kind: "add", player })}
    >
      <UserPlus aria-hidden="true" />
      Add
    </Button>
  );
}

/** Portrait, name (to the profile) and one line under it. */
function PlayerSummary({
  player,
  detail,
  online,
  onNavigate,
}: {
  player: Pick<FriendPlayer, "name" | "image">;
  detail: ReactNode;
  online?: boolean;
  onNavigate: () => void;
}) {
  const avatar = getPlayerAvatarBySrc(player.image) ?? DEFAULT_PLAYER_AVATAR;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="relative shrink-0">
        <Image
          src={avatar.src}
          alt=""
          width={72}
          height={72}
          className="h-9 w-9 rounded-[8px] bg-secondary/40 object-contain"
        />
        {online !== undefined ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_hsl(var(--popover))]",
              online ? "bg-success" : "bg-muted-foreground/60",
            )}
          />
        ) : null}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <Link
          href={playerProfileHref(player.name)}
          onClick={onNavigate}
          className="truncate text-[13px] font-semibold hover:text-primary"
        >
          {player.name}
        </Link>
        <span className="truncate text-[11px] text-muted-foreground">
          {detail}
        </span>
      </span>
    </span>
  );
}

function Empty({ icon, children }: { icon?: boolean; children: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 py-8 text-center text-sm text-muted-foreground">
      {icon ? (
        <Users className="h-6 w-6 opacity-50" aria-hidden="true" />
      ) : null}
      <p>{children}</p>
    </div>
  );
}

function RowSkeletons() {
  return (
    <div className="grid gap-1" aria-busy="true">
      <Skeleton className="h-[52px] w-full rounded-[8px]" />
      <Skeleton className="h-[52px] w-full rounded-[8px]" />
    </div>
  );
}
