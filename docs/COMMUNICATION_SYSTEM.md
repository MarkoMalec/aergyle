# Notifications and Messages

The two buttons at the top of the sidebar — the bell and the envelope — open
the **Communication Hub**, one window with two tabs.

- **Notifications** are the game writing to one player: a community project
  finished, a listing sold, whatever else is wired up later. One-way, and
  filtered by category.
- **Messages** are players writing to each other, plus the system messages the
  game (or a moderator) sends. Conversations, not a flat inbox.

Both live behind a single check (`/api/communication/summary`) that the
sidebar runs once a minute, so each button carries a dot while something is
unread. The count itself is in the hub.

## Tuning

Everything worth changing is in [`src/game/communication.ts`](../src/game/communication.ts):

| Constant | Default | What it does |
| --- | --- | --- |
| `MAX_CONVERSATIONS` | 10 | Conversations a player may keep. |
| `MAX_MESSAGES_PER_CONVERSATION` | 100 | Messages kept per thread; older ones fall off. |
| `MAX_MESSAGE_LENGTH` | 1000 | Characters in one message. |
| `NOTIFICATIONS_KEPT` | 50 | Notifications kept per player. |
| `NOTIFICATIONS_PAGE_SIZE` | 15 | Rows per "Load more". |

## Sending a notification

From anywhere on the server:

```ts
import { notify, notifyMany } from "~/server/communication";

await notify(userId, {
  category: "SETTLEMENT", // GENERAL | SETTLEMENT | QUEST | MARKET | COMBAT | SYSTEM
  title: "The Old Bridge is complete",
  body: "Tenreed finished the project you contributed to.",
  href: "/settlements/3", // optional; becomes the "Read more" link
});
```

`notify` never throws — a notification must not fail the action that caused
it — and prunes the player's list back to `NOTIFICATIONS_KEPT`. `notifyMany`
writes the same note to a list of players in one statement; their lists are
pruned the next time they look.

Wired up so far:

- **Community project completed** → every player who contributed
  (`src/server/settlements/projects.ts`).
- **A marketplace listing sold** → the seller
  (`src/app/api/marketplace/buy/route.ts`).

Admins can also write one by hand from **/admin/moderation** → *Write to
players*: to one player by name, or to everyone.

Opening the Notifications tab marks everything read (the dot clears), but the
rows stay highlighted for that viewing so the player can see what was new.

## Messages

### Shape

One `Conversation` per pair of players, found by `pairKey` — the two user ids
sorted and joined, so A→B and B→A always land on the same row. Each side has
its own `ConversationParticipant`, which is what makes everything one-sided:

| Field | Meaning |
| --- | --- |
| `hidden` | This player deleted the thread, or it is waiting for a free slot. |
| `unread` | New messages this player hasn't opened. |
| `clearedAt` | Messages up to here stay hidden from this player after a delete. |

A system thread (`system: true`) has one participant and messages with no
sender; it is shown as coming from **Aergyle** and cannot be replied to.

### The ten-conversation limit

A player keeps at most `MAX_CONVERSATIONS` **visible** threads.

- Writing to somebody new takes one of the sender's slots; at the limit they
  are told to delete one first. Replying inside a thread they already have
  never counts.
- A message arriving while the recipient is full leaves their side
  `hidden` **and** `unread` — a **waiting** conversation. The messages are
  stored; the player simply can't open the thread yet.
- The Messages tab says *"A new conversation is waiting for you. Delete one
  below to make room."* and shows the slot count (`3/10 conversations`).
- Slots refill by themselves: every time the player opens their list or
  deletes a thread, the newest waiting threads slide into the free slots. No
  button to press.

### Deleting

Deleting hides the thread for that player alone and stamps `clearedAt`, so
the other side keeps theirs untouched and the deleting player won't see the
old history if the thread comes back. Once nobody holds a thread any more —
neither visible nor waiting — the conversation and its messages are deleted
outright, which is what keeps the tables from growing forever, along with the
`MAX_MESSAGES_PER_CONVERSATION` trim on every send.

### Reporting

The flag in a conversation copies the **whole** thread into `MessageReport`
as a JSON transcript, exactly as it stood, so neither player can erase what a
moderator reads. Reporting the same thread twice refreshes the open report
rather than filing another.

Reports land in **/admin/moderation**, open ones first, with a count badge on
the admin sidebar and dashboard. A moderator reads the transcript and closes
the report as **handled** or **dismissed**, with a note. Closing only clears
the queue — acting on the player is a separate, manual decision.

## Endpoints

| Route | Does |
| --- | --- |
| `GET /api/communication/summary` | Unread counts for the sidebar. |
| `GET /api/notifications` | A page of notifications (`category`, `cursor`). |
| `DELETE /api/notifications` | Clears the player's own list. |
| `POST /api/notifications/read` | Marks `ids`, or everything, read. |
| `GET /api/messages` | Conversations, slot count and waiting count. |
| `POST /api/messages` | Sends: `conversationId` (reply) or `to` (new thread). |
| `GET /api/messages/[id]` | One thread; clears its unread mark. |
| `DELETE /api/messages/[id]` | Hides it for this player, frees a slot. |
| `POST /api/messages/[id]/report` | Files (or refreshes) a report. |
| `GET /api/messages/players?q=` | Players to write to, by name. |
| `PATCH /api/admin/moderation/reports/[id]` | Closes a report. |
| `POST /api/admin/communication` | Admin notification or system message. |

## Files

- `src/game/communication.ts` — the constants, labels, pair-key and time rules.
- `src/server/communication/` — `notifications.ts`, `messages.ts`,
  `moderation.ts`, and the `index.ts` everything imports from.
- `src/components/game/communication/` — the hub dialog and its two panels.
- `src/components/admin/moderation/` — the report queue and the send form.
- `tests/communication.test.ts` — `npm test`.
