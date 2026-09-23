# Settlements, NPCs, Quests and Community Projects

A settlement is a location's common ground. Where dungeons, hunting grounds
and gathering are where players produce, settlements are where they trade,
take on work and build things together. A location can hold any number of
villages, towns and cities, and a player must be at the location (and not
travelling) to use them.

## What players see

- **/region** (the **Region** menu item) shows the region map of the
  player's location: pins for its settlements, dungeons and hunting grounds,
  and a list of them beside the map (collapsible above it on phones). Only
  the player's own location has a map; the world atlas opens it from the
  current location's entry ("Explore …"), and other locations stay unseen
  until the player travels there. See [Maps](#maps).
- **/settlements/[id]** shows the settlement map, with a head for each NPC,
  and its community projects. The list beside the map says "Quest ready",
  "N new quests" and "Trades"; a head with a quest to hand in glows green.
- **/settlements/[id]/storage** is the settlement's storage, opened from the
  chest on its map: the inventory and the storage side by side, with stacks
  dragged between them or moved with the arrows in the middle. Clicking the
  pin opens it as a window over the settlement (an intercepted route); a
  direct visit or a refresh shows the same thing as its own page. See
  [Storage](#storage).
- **/settlements/[id]/npcs/[npcId]** shows the NPC's portrait, greeting and
  quests on the left, and its wares and a sell panel on the right. Each quest
  is a collapsible row: its header holds the name, status and repeat badges
  and a progress bar; opened, it shows the objectives and rewards as artwork
  with the count on top, and the accept, abandon or complete buttons. A quest
  ready to hand in starts open.
- The **Quests** button in the header (beside the gold) lists every active
  quest anywhere, with its progress and a link to the NPC to hand it in to.
  It loads when opened. Log out lives at the bottom of the sidebar.
- **New-quest dots** mark one-time quests the player has not seen yet (see
  below): on the Region menu item (and the mobile menu button), on the
  settlement's pin and on the NPC's head, and on their rows in the map lists.
  Hovering one says "New Quests available!".

Away from the location, the settlement and NPC pages show only a prompt to
travel there.

## Maps

The world atlas, region maps and settlement maps are 1536×1024 artworks shown
at that exact size; players drag them (or scroll, or use the arrow keys) to
see more, so a pin always sits where the admin put it. Pins are stored as
percentages (`mapX`, `mapY`) on the place itself.

- **World atlas** (`AtlasConfig.mapImage`, one row with id 1): the locations,
  each on its own pin (`Location.mapX`, `mapY`). A location without a pin is
  not on the atlas and cannot be travelled to from it.
- **Region map** (`Location.mapImage`): settlements (a diamond), dungeons and
  hunting grounds. A dungeon above the character's level, or a hunting
  ground above the Hunting level, shows a lock and does not open. Dungeon and
  hunting pins open those pages with the place selected (`/dungeons?dungeon=`,
  `/skills/Hunting?ground=`).
- **Settlement map** (`Settlement.mapImage`): NPC heads, cut from the
  portrait by the NPC's head crop (`headX`, `headY`, `headSize`; a default
  crop until one is chosen), and the settlement's storage, which wears the
  chest artwork every storage shares (`StorageConfig.icon`).

Places that aren't on the map yet are still in the list, and a location or
settlement without artwork shows the list alone. Gathering is not pinned.
`src/game/world/atlasLocations.ts` still holds each location's field notes and
the coordinates a new world starts from; the live pins are the database's.

## NPCs

NPCs are presented by name. A **profession** is optional and exists only to
grant services: `BLACKSMITH` is prepared for rarity upgrades and, later,
repairs. The services themselves are not built yet; `upgradeUserItemRarity`
in `src/utils/userItems.ts` already exists for the first one. Admins decide
how many NPCs each settlement has and can move an NPC to another settlement.

## Shops

Any item can be sold by any NPC at that NPC's own price (`NpcOffer.price`).
Items are granted at their own rarity, like every other item source.

A **rare find** is an offer with an availability window (`availableFrom` to
`availableUntil`). The admin sets a start and a duration in minutes, hours or
days. Players see a rare find like any other item; it is simply only listed,
and only buyable, inside its window. Stock is unlimited.

Purchases debit gold and grant the item in one transaction; a full inventory
cancels the purchase.

## Selling

Every NPC buys any item in the inventory, one or a whole stack at a time, for
the item's value: its base `Item.price`, the Value shown on the item card,
whatever the stack's rarity (`npcBuyPrice` in `shop.ts`). Equipped and listed
items are not in the inventory, so they can't be sold. The stack is reduced
only if it still holds what was read, so two simultaneous sales can never be
paid for the same items.

## Storage

A settlement can have one storage (`SettlementStorage`): a chest pinned on
its map that a player **rents once, with gold** (`unlockCost`), and then
keeps items in. Storage is per settlement, never shared: a sword left in the
Citadel stays in the Citadel, and is only reachable while the player is at
that location, like everything else in a settlement.

A storage holds `slots` **stacks** (10 by default, set per settlement in
admin). Each stack takes one slot however many items it holds; a stackable
item tops up a stack that is already there before it opens a new one. Extra
slots bought by a player come later — `UserStorage` is where they will live.

Stored items leave the inventory: they become `UserItem` rows with status
`IN_STORAGE`, held by the player's `UserStorage` row for that settlement, so
they no longer count for quests, crafting, selling or the marketplace. A
whole stack that nothing can merge with moves as it is, keeping its instance
(and so its rarity and any modifiers); a partial move splits it, and the
remainder merges on the other side. Every move is one transaction, and each
write only applies while the stack still holds what was read, so two
requests can never move the same items twice.

The window shows the **inventory as it really is** — every slot in its own
position, empty ones included, drawn like the character page's grid — beside
the storage's own slots. **Drag a stack across** to move all of it, or
**choose a stack and use the arrows** between them, which is also how a part
of a stack is moved (the amount box belongs to the chosen stack, so dragging
that one moves the amount shown and dragging any other moves it whole).
Clicking an item opens its details card, the same one as everywhere else.

Each slot is its own drop target, so a withdrawal lands in the inventory slot
it was dropped on (`toSlot`) when that one is free, and in the first free slot
otherwise. Storage keeps no positions of its own: a stack goes in the first
slot that fits, and every storage slot accepts a deposit.

The window brings its own drag-and-drop (`@dnd-kit`, the same sensors as the
inventory: a movement under 5px is a click, and touch waits 200ms so a tap
still opens an item and the window still scrolls). It does not use the
character page's `DndProvider`, which is built around inventory, equipment
and the discard slot; rearranging a side stays that page's job, and the
arrows remain the way to move things without a pointer drag.

## Quests

Quests belong to an NPC and repeat `ONCE`, `DAILY` or `WEEKLY`. Each has an
optional character level, gold, character XP (`XpActionType.QUEST`) and item
rewards, and any number of objectives. A quest above the character's level is
hidden everywhere (NPC page, NPC card counts, Quests menu) until the character
reaches it.

| Objective | Counts |
| --- | --- |
| **Deliver** item × N | Items held when completing. They are taken then, any rarity, lowest rarity first, so gathered and crafted goods both count. |
| **Defeat** creature × N | Kills in hunting grounds and dungeons after accepting. |
| **Clear** dungeon × N | Cleared runs of that dungeon after accepting. |

Players accept a quest, work on it anywhere, and hand it in at the NPC.
Abandoning drops the progress.

`UserQuest.period` is `ONCE`, the UTC day (`2026-09-19`) or the UTC week's
Monday (`W2026-09-14`). Daily quests reset at 00:00 UTC and weekly quests on
Monday at 00:00 UTC, with no job: a new period simply has no row yet.

### New-quest dots

One-time quests teach players their way around, so a new one is announced;
daily and weekly quests come back every period and never are. A one-time
quest is **unseen** while the player can take it (visible, within their level,
not accepted or completed) and has never had it on screen. Opening the NPC's
page records its unseen quests in `UserSeenQuest`, and the dots clear.

Only quests at the player's current location count, because the region map
shows only that location; while travelling there are none. A quest becomes
unseen when it is enabled, when its project completes, when the character
reaches its level, and when the player arrives where it is.

The dots share one query (`GET /api/settlements/quests/unseen`). It is checked
again on every page change and level-up, when a journey ends, and after a
settlement action, since a finished project can reveal quests.

Kill and clear progress is stored per target (`creature:<id>`,
`dungeon:<id>`), so admins can rewrite objectives without orphaning it.
`recordQuestProgress` runs inside the hunting and dungeon claim transactions.
Dungeon kills come from `DungeonResolution.kills`, which is kept out of the run
report, so the journal still never lists how many monsters a dungeon held.
Only monsters slain in a round the character survives count, matching loot.

## Community projects

A project belongs to a settlement and needs items. Every player can hand in
any rarity of them; contributions stop at each requirement's quantity (a
compare-and-set on `contributed` prevents overfilling). When every
requirement is met the project is completed.

NPCs, shop offers and quests can be marked **hidden until project X**. They
stay invisible until that project completes, which is how a project changes a
settlement ("the bridge is rebuilt and a ferry trader arrives"). The project
may be in any settlement. Deleting a project reveals everything it hid.

Each project shows a **contributor leaderboard**. A player's share is the
average, over requirements, of the part of each requirement they supplied, so
every requirement weighs the same however many items it asks for.

## Administration

- **/admin/settlements**: every location with its settlements, and a form to
  create one. New settlements, NPCs, quests, projects and storages start
  disabled. The **Storage icon** here is the chest artwork every storage in
  the game uses.
- **/admin/settlements/[id]** has the **Storage** panel: add the
  settlement's storage, then set its name, rent cost, how many stacks it
  holds, and whether players can see it. Deleting it destroys what players
  kept in it; disabling it only hides it.
- **/admin/settlements/[id]**: details (name, location, kind, banner image,
  description), its NPCs, and its community projects with progress,
  contributor counts and what each one unlocks. Raising a requirement of a
  completed project reopens it.
- **/admin/locations**: the **World atlas**: the artwork path and a
  drag-and-drop editor for the locations, shown as players see it. A new
  artwork keeps every pin where it is.
- **/admin/locations/[id]**: the **Region map**: the artwork path and a
  drag-and-drop editor for the location's settlements, dungeons and hunting
  grounds, shown exactly as players see it. Place a pin from the list beside
  the map, drag it into position, and save.
- **/admin/settlements/[id]** also has the **Settlement map** editor for its
  NPCs and its storage.
- **/admin/npcs/[id]**: profile (name, settlement, profession, portrait path,
  map head, greeting, hidden-until project) and the shop, saved together from
  the bar that appears on unsaved changes. The map head is chosen on the
  portrait: drag the circle and zoom with the slider. Rare finds show whether
  they are
  upcoming, on sale or ended. Below it, the NPC's quests with objectives and
  rewards, and how many times each was completed.

Items, creatures and dungeons are chosen with a searchable picker.

## Code

- `src/server/settlements/`: `rules.ts` (pure: periods, windows, progress,
  shares, `planStackFill`), `access.ts` (visibility and presence), `shop.ts`,
  `storage.ts`, `quests.ts`, `projects.ts`, `pages.ts` (page loaders, the
  region page too).
- `src/server/items/consumeItems.ts`: shared inventory consumption (by item,
  lowest rarity first, or from one stack when selling), also used by
  gardening.
- Maps: `src/game/world/maps.ts` (map size, pins, head crops),
  `src/components/game/map/PlaceMap.tsx` (map, pins and list),
  `NpcHead.tsx`, `src/components/admin/MapEditor.tsx`, and
  `PATCH /api/admin/maps`, which saves a map's artwork and moved pins.
- `src/components/game/settlements/useUnseenQuests.ts`: the unseen-quest
  query behind every `NewQuestsDot`, and marking an NPC's quests as seen.
- Storage: `src/app/(game)/settlements/[id]/storage/` (the page) and
  `@modal/(.)storage/` (the same view intercepted into `StorageDialog`); the
  `@modal` slot is declared in `settlements/[id]/layout.tsx`. The window
  itself is `src/components/game/settlements/StorageExchange.tsx`, which
  reuses the inventory's slot styling and the shared item card
  (`ItemDetailsPopoverContent` with `LoadedItemDetails`) behind its own
  draggable triggers; its pin face is
  `src/components/game/map/StorageFace.tsx`.
- Player API: `/api/settlements/buy`, `/api/settlements/sell`,
  `/api/settlements/quests` (GET: active quests),
  `/api/settlements/quests/[accept|complete|abandon]`,
  `/api/settlements/quests/unseen` (GET), `/api/settlements/quests/seen`
  (POST), `/api/settlements/projects/contribute`,
  `/api/settlements/storage/[unlock|move]`. Admin API:
  `/api/admin/settlements`, `/api/admin/npcs`, `/api/admin/quests`,
  `/api/admin/community-projects`, `/api/admin/storages` (and
  `/api/admin/storages/config` for the shared chest icon).

## Operations

1. Deploy `prisma/migrations/20260919120000_settlements_npcs_quests/`,
   `prisma/migrations/20260919180000_user_seen_quests/`,
   `prisma/migrations/20260919210000_region_settlement_maps/` and
   `prisma/migrations/20260922120000_settlement_storage/`.
2. Run the rules tests with `npm run test:settlements` and the dungeon tests
   with `npm run test:dungeons`.
3. Create settlements in /admin/settlements. NPC portraits live in
   `public/assets/npcs/`, map artwork in `public/assets/world/`.
4. Set the storage chest icon in /admin/settlements before enabling a
   storage; without it the pin falls back to a plain icon.

## Planned

- **More storage slots.** Players buying extra slots in a storage they
  already rent, on top of the settlement's own `slots`.
- **Travelling merchant.** An NPC who moves between settlements on a schedule
  (for example 24 hours in each) with rare stock, so players plan journeys
  around where it will be next. Waiting for its artwork.
- **Regional events.** Timed events for a location, such as a goblin raid
  (a hunting ground grows tougher and richer) or a harvest fair (a vocation XP
  bonus and special stock), configured in admin. `XpMultiplier` can carry the
  XP part.
- **Blacksmith services.** Rarity upgrades at blacksmith NPCs, then repairs.
