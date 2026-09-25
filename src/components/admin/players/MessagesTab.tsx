"use client";

import Link from "next/link";
import React from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Panel } from "~/components/admin/fields";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  NOTIFICATION_CATEGORY_LABELS,
  timeAgo,
} from "~/game/communication";
import { cn } from "~/lib/utils";
import {
  ActionButton,
  Empty,
  formatDate,
  Row,
  Tag,
  usePlayerEdit,
} from "./shared";

function Conversations() {
  const { player, run } = usePlayerEdit();
  return (
    <Panel
      title="Conversations"
      description="Every thread they are part of, including ones they deleted on their side. Deleting a thread removes it for both players; a report keeps its own copy."
    >
      {player.conversations.length === 0 ? (
        <Empty>No conversations.</Empty>
      ) : (
        <div className="space-y-2">
          {player.conversations.map((thread) => {
            const other = thread.system ? "Aergyle (system)" : (thread.with?.name ?? "Deleted player");
            return (
              <Collapsible key={thread.id} className="rounded-lg bg-black/25">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform group-data-[state=open]:rotate-180" />
                    <span className="truncate text-sm font-medium">{other}</span>
                    <span className="text-xs text-white/45">
                      {thread.messages.length} message{thread.messages.length === 1 ? "" : "s"} ·{" "}
                      {timeAgo(thread.lastMessageAt)}
                    </span>
                    {thread.unread ? <Tag tone="info">Unread</Tag> : null}
                    {thread.hidden ? <Tag>Deleted on their side</Tag> : null}
                  </CollapsibleTrigger>
                  {thread.with ? (
                    <Link
                      href={`/admin/players/${thread.with.id}`}
                      className="text-xs text-white/60 hover:text-white hover:underline"
                    >
                      Open {thread.with.name ?? "player"}
                    </Link>
                  ) : null}
                  <ActionButton
                    actionKey={`thread-${thread.id}`}
                    variant="destructive"
                    confirm={`Delete this whole conversation with ${other}, for both players?`}
                    onClick={() =>
                      run(
                        `thread-${thread.id}`,
                        "/messages",
                        "DELETE",
                        { conversationId: thread.id },
                        "Conversation deleted",
                      )
                    }
                  >
                    Delete thread
                  </ActionButton>
                </div>
                <CollapsibleContent className="space-y-1.5 px-4 pb-4">
                  {thread.messages.length === 0 ? (
                    <Empty>No messages left.</Empty>
                  ) : (
                    thread.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "group flex items-start gap-3 rounded-md px-3 py-2",
                          message.mine ? "bg-sky-400/[0.07]" : "bg-white/[0.03]",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-white/45">
                            <span className="font-semibold text-white/75">{message.sender}</span>{" "}
                            · {formatDate(message.createdAt)}
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                            {message.body}
                          </p>
                        </div>
                        <ActionButton
                          actionKey={`message-${message.id}`}
                          variant="ghost"
                          className="h-7 px-2"
                          confirm="Delete this message for both players?"
                          onClick={() =>
                            run(
                              `message-${message.id}`,
                              "/messages",
                              "DELETE",
                              { messageId: message.id },
                              "Message deleted",
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete message</span>
                        </ActionButton>
                      </div>
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Notifications() {
  const { player, run } = usePlayerEdit();
  return (
    <Panel
      title="Notifications"
      description="Notes the game sent them. The game keeps only the newest ones per player."
      action={
        player.notifications.length > 0 ? (
          <ActionButton
            actionKey="notifications-all"
            variant="ghost"
            confirm="Delete all their notifications?"
            onClick={() =>
              run("notifications-all", "/notifications", "DELETE", {}, "Notifications deleted")
            }
          >
            Delete all
          </ActionButton>
        ) : null
      }
    >
      {player.notifications.length === 0 ? (
        <Empty>No notifications.</Empty>
      ) : (
        <div className="space-y-2">
          {player.notifications.map((note) => (
            <Row key={note.id} className="items-start py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {note.title}
                  <Tag>{NOTIFICATION_CATEGORY_LABELS[note.category]}</Tag>
                  {note.readAt ? null : <Tag tone="info">Unread</Tag>}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-white/70">
                  {note.body}
                </p>
                <div className="mt-0.5 text-xs text-white/45">
                  {formatDate(note.createdAt)}
                  {note.href ? ` · links to ${note.href}` : ""}
                </div>
              </div>
              <ActionButton
                actionKey={`notification-${note.id}`}
                variant="ghost"
                onClick={() =>
                  run(
                    `notification-${note.id}`,
                    "/notifications",
                    "DELETE",
                    { id: note.id },
                    "Notification deleted",
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete notification</span>
              </ActionButton>
            </Row>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function MessagesTab() {
  return (
    <div className="space-y-6">
      <Conversations />
      <Notifications />
    </div>
  );
}
