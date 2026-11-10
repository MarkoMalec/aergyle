# Audit follow-ups

What the November 2026 audit found and this round of fixes did not cover. Most urgent first.

## Before the next deploy or dev session

- **Apply the `bannedAt` migration** (`prisma/migrations/20261110120000_user_banned_at`). The session check (`isActive` in `src/server/auth.ts`) and the admin player page read `User.bannedAt`. Until the column exists, every signed-in request fails. `deploy/deploy.sh` applies it before the new containers start. Dev shares the production database, so dev is broken until it is applied there. It only adds a column, so the code running now is unaffected.

## Left open on purpose

- **NPC buy/sell price loop** (audit #4). An NPC offer priced below the item's base price lets players buy, sell back and repeat for unlimited gold. Fix: reject `offer.price < item.price` when an NPC is saved in `src/app/api/admin/npcs/[id]/route.ts`, and add a test over the seeded offers. Check the live offers first.
- **`/@name` rewrite path traversal** (audit #19, `src/middleware.ts:84-87`). Refuse tags that contain `/`, `\` or are made only of dots.

## Should do

- **Daemon still scans whole tables.** Every tick it loads all vocation and garden rows and filters them in JS (`src/realtime/daemon.ts`, `findDueUserIds`). The default interval is now 1000 ms. The real fix is a per-player next-due time, kept in memory and refreshed on start/stop events, so the tick only touches due players.
- **Race and lock code has no tests.** `tests/` only covers pure functions. The new locks (`lockUser`, inventory before snapshot, message caps) were never run against a database. Add a few E2E scripts using the pattern in memory note "Server code E2E outside Next": two parallel starts, two parallel sends at the cap, XP from a tick and a quest at once.
- **Lock order.** Quest turn-in locks the inventory, then writes `User`. Activity starts lock `User` first, then may lock the inventory (bait). The same player doing both at the same moment can deadlock. MariaDB then rolls one back and the player sees a generic error. Nothing is lost, but if it shows up in logs, take `lockUser` first in quest turn-in.
- **Banned players and middleware.** `src/middleware.ts` reads the raw JWT, so a banned player still gets past the middleware redirect. Every page and API sees them as signed out within 5 minutes. A ban also takes up to 5 minutes to apply (the `isActive` cache).
- **`promoteWaiting` without the lock.** It is still unlocked when called from the conversation list and from `sendSystemMessage` (`src/server/communication/messages.ts`). A recipient can rarely end up at 11/10.
- **Health is still a plain read.** Claims and eating read health inside their transaction but do not lock the row, so a heal that lands in the few milliseconds between that read and the write can still be lost.

## Smaller leftovers from the audit

- Notifications are never pruned for players who never open the bell. Add a weekly delete of rows older than 30 days.
- Profile comments: the 6/min limit is per author, not per profile. Cap comments per profile.
- The friend cap (100), the pending-request cap (20) and the 50 open buy orders are count-then-insert, so parallel requests can pass them by a few.
- The "bound" flag (`isTradeable: false`) is lost when stacks are split or merged (`settlements/storage.ts`, `marketplace/merge-stacks`, `grantItem.ts`).
- Travel completion and cancel delete by `userId`, not by row id, so a stale request can delete a newly started trip.
- The "While you were away" summary can be deleted unseen if it commits after the GET (`activitySummaries.ts`).
- `NEXTAUTH_SECRET` should be `.min(32)` in `src/env.js`.
- The realtime token sits in the websocket URL, so it shows up in proxy logs. It lives 60 s; it could be sent as the first message instead.
- Eating food now always loads the stat snapshot, even for food that does not heal. That is a few extra queries per eat.
- Helpers left duplicated because their outputs differ: `clampPercent` (3 copies, different NaN handling), `formatNumber` (locale vs en-US), the `formatDuration`/`formatSpan` variants, and the "… ago" helpers. Unify them only if the small output differences don't matter.
- `npm run lint` has older errors (mostly untyped `req.json()` bodies in API routes).
