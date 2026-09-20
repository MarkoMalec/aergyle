"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Flag,
  MessageSquarePlus,
  Send,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { MAX_MESSAGE_LENGTH, timeAgo } from "~/game/communication";
import {
  DEFAULT_PLAYER_AVATAR,
  getPlayerAvatarBySrc,
} from "~/lib/player-avatars";
import { communicationQueryKeys } from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import type {
  ConversationList,
  ConversationThread,
  PlayerRef,
} from "~/server/communication";
import {
  communicationFetch,
  useRefreshCommunication,
} from "./useCommunication";
import toast from "react-hot-toast";

type View = { kind: "list" } | { kind: "thread"; id: number } | { kind: "new" };

export function MessagesPanel() {
  const [view, setView] = useState<View>({ kind: "list" });

  if (view.kind === "thread") {
    return (
      <Thread
        conversationId={view.id}
        onBack={() => setView({ kind: "list" })}
      />
    );
  }
  if (view.kind === "new") {
    return (
      <Compose
        onBack={() => setView({ kind: "list" })}
        onSent={(id) => setView({ kind: "thread", id })}
      />
    );
  }
  return (
    <ConversationsList
      onOpen={(id) => setView({ kind: "thread", id })}
      onCompose={() => setView({ kind: "new" })}
    />
  );
}

/** The player's threads, with the slot count and anything waiting for room. */
function ConversationsList({
  onOpen,
  onCompose,
}: {
  onOpen: (id: number) => void;
  onCompose: () => void;
}) {
  const refresh = useRefreshCommunication();
  const query = useQuery({
    queryKey: communicationQueryKeys.conversations(),
    queryFn: () => communicationFetch<ConversationList>("/api/messages"),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      communicationFetch(`/api/messages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Conversation deleted");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid min-h-0 gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="secondary" onClick={onCompose}>
          <MessageSquarePlus size={14} aria-hidden="true" />
          New message
        </Button>
        {query.data ? (
          <span className="rounded-[8px] bg-secondary/40 px-2 py-1 text-[11px] tabular-nums text-muted-foreground">
            {query.data.used}/{query.data.limit} conversations
          </span>
        ) : null}
      </div>

      {query.data && query.data.waiting > 0 ? (
        <p className="rounded-[8px] bg-primary/10 px-3 py-2 text-[13px] leading-relaxed text-primary">
          {query.data.waiting === 1
            ? "A new conversation is waiting for you."
            : `${query.data.waiting} new conversations are waiting for you.`}{" "}
          Delete one below to make room and it will appear here.
        </p>
      ) : null}

      <div className="max-h-[52vh] min-h-0 overflow-y-auto pr-1">
        {query.isError ? (
          <p className="p-4 text-sm text-muted-foreground">
            Couldn&apos;t load your messages.
          </p>
        ) : !query.data ? (
          <div className="grid gap-2" aria-busy="true">
            <Skeleton className="h-14 w-full rounded-[8px]" />
            <Skeleton className="h-14 w-full rounded-[8px]" />
          </div>
        ) : query.data.conversations.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            You have no messages.
          </p>
        ) : (
          <ul className="grid gap-1">
            {query.data.conversations.map((conversation) => (
              <li key={conversation.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpen(conversation.id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors",
                    conversation.unread
                      ? "bg-secondary/45 shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                      : "bg-secondary/20 hover:bg-secondary/40",
                  )}
                >
                  <Portrait player={conversation.with} />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <strong className="truncate text-[13px] font-semibold">
                        {conversation.with.name}
                      </strong>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(conversation.lastMessageAt)}
                      </span>
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">
                      {conversation.preview}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(conversation.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-muted-foreground hover:bg-secondary/60 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span className="sr-only">
                    {`Delete the conversation with ${conversation.with.name}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Deleting removes a conversation for you only; the other player keeps
        theirs.
      </p>
    </div>
  );
}

/** One thread: its messages, the reply box and the report button. */
function Thread({
  conversationId,
  onBack,
}: {
  conversationId: number;
  onBack: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const bottom = useRef<HTMLLIElement>(null);

  const query = useQuery({
    queryKey: communicationQueryKeys.conversation(conversationId),
    queryFn: () =>
      communicationFetch<ConversationThread>(`/api/messages/${conversationId}`),
  });

  // The newest message is the one worth seeing first.
  useEffect(() => {
    bottom.current?.scrollIntoView();
  }, [query.data?.messages.length]);

  // Opening a thread clears its unread mark on the server.
  useEffect(() => {
    if (query.data) {
      void queryClient.invalidateQueries({
        queryKey: communicationQueryKeys.summary(),
      });
    }
  }, [query.data, queryClient]);

  const report = useMutation({
    mutationFn: () =>
      communicationFetch(`/api/messages/${conversationId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setReporting(false);
      setReason("");
      toast.success("Reported. A moderator will read this conversation.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const player = query.data?.with;

  return (
    <div className="grid min-h-0 gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span className="sr-only">Back to your conversations</span>
        </button>
        {player ? <Portrait player={player} /> : null}
        <strong className="min-w-0 flex-1 truncate text-sm">
          {player?.name ?? "…"}
        </strong>
        {query.data && !query.data.system ? (
          <button
            type="button"
            onClick={() => setReporting((open) => !open)}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-[8px] hover:bg-secondary/60",
              reporting
                ? "text-destructive"
                : "text-muted-foreground hover:text-destructive",
            )}
          >
            <Flag size={15} aria-hidden="true" />
            <span className="sr-only">Report this conversation</span>
          </button>
        ) : null}
      </div>

      {reporting ? (
        <div className="grid gap-2 rounded-[8px] bg-destructive/10 p-3">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Reporting saves this whole conversation for a moderator to read,
            even if either of you deletes it afterwards.
          </p>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What is wrong here? (optional)"
            maxLength={MAX_MESSAGE_LENGTH}
            className="h-9 text-[13px]"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReporting(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={report.isPending}
              onClick={() => report.mutate()}
            >
              {report.isPending ? "Reporting…" : "Report conversation"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="max-h-[44vh] min-h-0 overflow-y-auto pr-1">
        {query.isError ? (
          <p className="p-4 text-sm text-muted-foreground">
            This conversation is no longer available.
          </p>
        ) : !query.data ? (
          <div className="grid gap-2" aria-busy="true">
            <Skeleton className="h-12 w-2/3 rounded-[8px]" />
            <Skeleton className="ml-auto h-12 w-2/3 rounded-[8px]" />
          </div>
        ) : (
          <ul className="grid gap-2">
            {query.data.messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-[8px] px-3 py-2",
                  message.mine
                    ? "justify-self-end bg-primary/15"
                    : "justify-self-start bg-secondary/35",
                )}
              >
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                  {message.body}
                </p>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {message.mine ? "You" : message.sender} ·{" "}
                  {timeAgo(message.createdAt)}
                </span>
              </li>
            ))}
            <li ref={bottom} className="h-0" aria-hidden="true" />
          </ul>
        )}
      </div>

      {query.data?.system ? (
        <p className="rounded-[8px] bg-secondary/25 px-3 py-2 text-[12px] text-muted-foreground">
          These messages come from the game. You can&apos;t reply to them.
        </p>
      ) : query.data ? (
        <Composer
          onSend={(body) =>
            communicationFetch<{ conversationId: number }>("/api/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId, body }),
            })
          }
          onSent={() => undefined}
        />
      ) : null}
    </div>
  );
}

/** Picking a player to write to, then the first message. */
function Compose({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: (conversationId: number) => void;
}) {
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<PlayerRef | null>(null);

  const players = useQuery({
    queryKey: communicationQueryKeys.players(term.trim()),
    queryFn: () =>
      communicationFetch<{ players: PlayerRef[] }>(
        `/api/messages/players?q=${encodeURIComponent(term.trim())}`,
      ),
    enabled: !picked && term.trim().length >= 2,
  });

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span className="sr-only">Back to your conversations</span>
        </button>
        <strong className="text-sm">New message</strong>
      </div>

      {picked ? (
        <div className="flex items-center gap-3 rounded-[8px] bg-secondary/30 px-3 py-2">
          <Portrait player={picked} />
          <strong className="min-w-0 flex-1 truncate text-[13px]">
            {picked.name}
          </strong>
          <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search for a player by name"
            className="h-9 text-[13px]"
            autoFocus
          />
          {term.trim().length >= 2 ? (
            players.data && players.data.players.length > 0 ? (
              <ul className="grid gap-1">
                {players.data.players.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(player)}
                      className="flex w-full items-center gap-3 rounded-[8px] bg-secondary/20 px-3 py-2 text-left hover:bg-secondary/45"
                    >
                      <Portrait player={player} />
                      <span className="truncate text-[13px]">
                        {player.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 text-[12px] text-muted-foreground">
                {players.isPending ? "Searching…" : "No players by that name."}
              </p>
            )
          ) : null}
        </div>
      )}

      <Composer
        disabled={!picked}
        onSend={(body) =>
          communicationFetch<{ conversationId: number }>("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: picked?.id, body }),
          })
        }
        onSent={(result) => onSent(result.conversationId)}
      />
    </div>
  );
}

/** The write-and-send box, shared by replies and new threads. */
function Composer({
  disabled,
  onSend,
  onSent,
}: {
  disabled?: boolean;
  onSend: (body: string) => Promise<{ conversationId: number }>;
  onSent: (result: { conversationId: number }) => void;
}) {
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();

  const send = useMutation({
    mutationFn: () => onSend(body),
    onSuccess: (result) => {
      setBody("");
      void queryClient.invalidateQueries({
        queryKey: communicationQueryKeys.all(),
      });
      onSent(result);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ready = body.trim().length > 0 && !disabled && !send.isPending;

  return (
    <div className="grid gap-2">
      <textarea
        value={body}
        disabled={disabled}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends; Shift+Enter starts a new line.
          if (event.key === "Enter" && !event.shiftKey && ready) {
            event.preventDefault();
            send.mutate();
          }
        }}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={3}
        placeholder={disabled ? "Choose a player first" : "Write a message…"}
        className="w-full resize-none rounded-[8px] bg-surface-inset px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {body.length}/{MAX_MESSAGE_LENGTH}
        </span>
        <Button size="sm" disabled={!ready} onClick={() => send.mutate()}>
          <Send size={14} aria-hidden="true" />
          {send.isPending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

/** A player's avatar, or the game's own mark on a system thread. */
function Portrait({ player }: { player: PlayerRef }) {
  if (!player.id) {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-primary/15 text-primary">
        <Sparkles size={16} aria-hidden="true" />
      </span>
    );
  }
  const avatar = getPlayerAvatarBySrc(player.image) ?? DEFAULT_PLAYER_AVATAR;
  return (
    <Image
      src={avatar.src}
      alt=""
      width={72}
      height={72}
      className="h-9 w-9 shrink-0 rounded-[8px] bg-secondary/40 object-contain"
    />
  );
}
