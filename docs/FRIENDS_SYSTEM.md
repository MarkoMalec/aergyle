# Friends

The **Friends** button in the sidebar opens the Friends window.

- **Friends** lists everyone you are friends with: online first, then whoever
  was seen most recently, with their level and location.
- **Search** finds players by name tag. It runs when the player presses the
  **Search** button, not as they type, to keep the database calls down. Each
  result shows where you stand with them: add, waiting, accept or friends.
- **Requests** holds the requests waiting for your answer (accept or decline)
  and the ones you sent (cancel).

Elsewhere, a player's profile (`/@Name`) has an **Add friend** button that
follows the same states, and the leaderboard has a **Friends** filter that
shows only you and your friends, ranked among yourselves.

## Tuning

Everything worth changing is in [`src/game/friends.ts`](../src/game/friends.ts):

| Constant | Default | What it does |
| --- | --- | --- |
| `MAX_FRIENDS` | 100 | Friends one player may have. |
| `MAX_PENDING_REQUESTS` | 20 | Requests a player may have waiting at once. |
| `FRIEND_REQUEST_COOLDOWN_MS` | 3 days | How long before a declined player may ask again. |
| `FRIEND_SEARCH_RESULTS` | 10 | Players one search returns. |
| `FRIEND_SEARCH_MIN_LENGTH` | 2 | Characters a search needs before it runs. |
| `FRIEND_SEARCHES_PER_MINUTE` | 12 | Searches one player may run per minute. |
| `FRIEND_ACTIONS_PER_MINUTE` | 30 | Adds, accepts, declines and removals per minute. |

## Shape

- A **`Friendship`** is two rows, one per side, so a player's list is one
  indexed read. Both rows are created and removed together.
- A **`FriendRequest`** is one row per pair, found by `pairKey` (the two ids
  sorted and joined), so neither side can stack requests.
- **Asking back accepts.** Adding a player who already asked you turns their
  request into a friendship. If both ask at the same moment, the one who loses
  the race accepts on the retry.
- A **declined** request stays, stamped `declinedAt`, for the cooldown: the
  sender can't ask again until it is over, then their new request takes the
  row. Old declines are cleaned up whenever someone declines.
- `DELETE` takes an **`expect`** (`friends`, `outgoing` or `incoming`): what
  the player saw when they clicked. If the state has moved on (say the other
  side accepted while "Cancel request" was showing) nothing is removed and the
  player is told to take another look.

## Notifications

- The dot on the Friends button is the number of pending incoming requests,
  `friendRequests` in `/api/communication/summary`, which the sidebar already
  checks once a minute.
- When a request is accepted, the requester gets a **GENERAL** notification
  linking to the new friend's profile.

## Endpoints

| Route | Does |
| --- | --- |
| `GET /api/friends` | Friends, incoming and outgoing requests, and the limits. |
| `GET /api/friends/search?q=` | Players whose name tag starts with `q`, each with your relation to them. |
| `POST /api/friends/[playerId]` | Asks the player, or accepts their request. |
| `DELETE /api/friends/[playerId]?expect=` | Unfriends, cancels or declines; `expect` is the relation the player saw. |

Adds, accepts and removals share one rate limit; searches have their own. A
search term that is too short answers with no players and costs nothing.

## Files

- `src/game/friends.ts` — the constants, relations, pair-key and search rules.
- `src/server/players/friends.ts` — lists, search, add/accept and end.
- `src/app/api/friends/` — the routes above.
- `src/components/game/friends/` — the Friends window and the profile button.
- `tests/friends.test.ts` — `npm test`.
