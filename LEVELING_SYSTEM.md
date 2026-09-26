# Leveling and balance simulations

## How levels work

- A character has one lifetime XP total (`User.experience`); its level is the
  highest `LevelXpThreshold` row that total reaches.
- Every skill has its own lifetime XP (`UserTrackProgress`, track type
  `SKILL`, key = the skill). All skills share one curve, the `SKILL` rows of
  `TrackXpThreshold`.
- Skill activities pay the same XP to their skill and to the character.
  Dungeons and quests pay the character only. Per-player boosts
  (`XpMultiplier`) apply on top.

## Designing a curve: `/admin/leveling`

A curve is stored as a design (`LevelCurveDesign`) and generated into its
threshold table. The XP from level L to L + 1 is

```
firstLevelXp × L^power × (1 + growthPercent / 100)^(L − 1) × bands
```

rounded down, at least 1 (`src/game/balance/curve.ts`).

- **Power** is polynomial growth (1 linear, 2 quadratic). **Growth per level**
  compounds (RuneScape uses about 10.4%). Presets change the shape and keep
  the XP needed for level 100.
- **Difficulty bands** multiply the cost of reaching a range of levels (walls,
  soft caps, easier early levels).
- **Pacing targets** ("level 50 in 30 days") are drawn on the time chart and
  marked on track, slower or faster.
- The time chart and table use the player journey below, for a chosen player
  profile, with today's content.

Saving writes the design and the table and recalculates every player's level
from their lifetime XP, in one transaction. XP never changes, so saving the
previous design restores everyone. Running processes (web and realtime
daemon) reload curves within 30 seconds (`CURVE_REFRESH_MS`); a stored level
that lags behind is corrected the next time it is read.

With no stored design the page starts from `DEFAULT_CURVE_DESIGNS`, which
reproduce the tables that were live before designs existed (character
`5 × L^1.5`, skills ten times that). An empty threshold table also falls back
to these defaults.

## Simulations: `/admin/simulations`

Pure, client-side simulations over live content (`src/game/balance/`), loaded
once by `src/server/balance/content.ts`. They follow the game's own rules:
skill gates, the character level of the locations offering a resource,
recipes, tool efficiency, 8-hour vocation starts, expedition and dungeon
lengths.

- **Player journey** plays a character day by day. The profile sets hours of
  activity and check-ins per day: an activity only runs until its idle cap,
  so short runs need frequent check-ins. Time is split evenly over the chosen
  activities or goes to the most character XP first; each activity always
  uses its best source at the current levels. The garden grows alongside and
  pays per replant; quests pay when unlocked (daily and weekly ones repeat).
  Crafting can use bought materials or include gathering them (time and XP).
  Levels are reached exactly, not sampled.
- **XP sources** lists every source with XP per hour and hours per level when
  it opens, flags sources that are never the best choice and big jumps, and
  shows resources no location offers. Per-group what-if multipliers change
  the simulations; "Apply" rewrites that group's stored XP rewards
  (rounded, never below 1).
- **Unlocks** puts every level gate (locations, dungeons, quests, items,
  resources, expedition tiers and areas) on a timeline with the day the
  journey reaches it, and flags long waits.
- **Dungeons & gear** finds the lowest level that survives each dungeon
  (live combat resolver, base stats by level plus the strongest item per slot
  at a chosen rarity), and lists items weaker than a lower-level item of their
  slot.

Hunting, gathering and single-dungeon Monte Carlo simulators stay on their
own admin pages, where they test unsaved edits.

## Code

- `src/game/balance/` — curve maths, content types, XP sources, journey,
  combat, unlocks (pure; tested in `tests/balance.test.ts`).
- `src/server/balance/` — content loader, saving designs, bulk XP scaling.
- `src/utils/leveling.ts`, `src/utils/progression.ts` — awarding XP.
- `src/components/admin/balance/` — the two admin pages.
