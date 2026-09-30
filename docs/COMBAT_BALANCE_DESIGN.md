# Combat and stat balance plan

**Status: planned, not implemented.** Agreed with the game's owner on
30 September 2026. The code still runs the formulas listed in
[FORMULA_REFERENCE.md](FORMULA_REFERENCE.md). Implement from this document.
When a part lands, describe it in the system docs
([CHARACTER_STATS_SYSTEM.md](CHARACTER_STATS_SYSTEM.md),
[DUNGEONS_SYSTEM.md](DUNGEONS_SYSTEM.md), [HUNTING_SYSTEM.md](HUNTING_SYSTEM.md)),
update the formula reference, and mark the part done here.

Background with interactive charts (point-in-time snapshots, private to the
owner's claude.ai account): the formula review "Aergyle Formula Atlas"
(https://claude.ai/artifact/3adbMDTbe2q1HWiReHVxD1) and the earlier stat-curve
review (https://claude.ai/artifact/J6o3Nx49iaKvAZpyi6NGKN).

## Principles

Read these before changing any stat, formula or item numbers.

1. **Aergyle never ends.** It is an incremental idle MMO. Level caps, gear
   tiers and content keep being raised, and nobody should be able to finish
   the game. Endgame gear is meant to be very powerful, because endgame
   content will require it.
2. **Current item and creature numbers are placeholders.** Most gear and
   monster stats were entered to make systems work, not to balance them.
   Don't treat them as balance targets and don't report single items as
   outliers. Balance comes from the curves and budgets in this document, and
   content is authored against them.
3. **Compare ratings with something that grows.** A rating measured against a
   fixed constant breaks as numbers grow: with damage × `100 / (100 + armor)`,
   every new gear tier creeps toward immunity. Armor is measured against the
   attacker's level and evasion against the attacker's accuracy. Stats that
   stay plain percentages with a hard cap (critical chance, block,
   resistances, lifesteal, thorns) need per-item caps (`ItemStat.maxValue`),
   because rarity multiplies them by up to 3.
4. **No hard counters.** Every defense works against every attacker to some
   degree. Type-specific defenses are capped top-ups, so any counter stays
   bounded (roughly 1.2–1.5×) and visible. In async PvP the defender is
   offline and can't react, so an unbounded counter lets attackers farm them.
5. **Tunable in /admin, snapshotted at start.** Every constant below lives in
   an admin-editable config row with a code default. An activity stores the
   values it used when it starts, so admin edits never change a run in
   progress. A snapshot without the new values resolves with today's rules.
6. **One pure rule set.** Combat math stays in pure, client-safe modules
   (`src/server/combat/rules.ts`, `src/game/`). The admin simulators run the
   same functions in the browser, and PvP will too. Keep `server-only`
   imports out of them.

## Decisions

Decided by the owner on 30 September 2026:

- Magic damage stays.
- Accuracy stays, as the counter to evasion. Evasion from cloth gear can be
  overpowered in PvE and in PvP.
- Lifesteal and Thorns stay. No gear has them yet; that's expected.
- Mana and Mana Regen are removed. Nothing uses them and nothing is planned
  to.

Accepted recommendations (confirm the default numbers when implementing):

- Armor reduces every hit, with K from the attacker's level.
- Magic Resist becomes a capped resistance percentage.
- Block halves physical hits only.
- The three evasion stats merge into one Evasion rating.
- Attack speed comes from the main-hand weapon only.
- Experience Gain is removed. `XpMultiplier` rows are the XP boost system.
- XP boosts add instead of multiply. Find and quantity bonuses get soft caps.

Still open:

- Target reduction for on-level armor: 50% (K₀ = 50, K₁ = 3, the default) or
  60% (K₀ = 33, K₁ = 2).
- Resistance caps. 75% in PvE and 30% in PvP are the starting values. The cap
  decides how strongly a Magic Resist stacker counters a magic build.
- Prayer Points and Gold Find stay hidden until a system reads them.
- The PvP format itself.

## One hit, in order

One function replaces both `resolveCreatureStrike` (creature → character, in
`src/server/combat/rules.ts`) and `characterStrike` (character → monster, in
`src/server/dungeons/resolver.ts`). PvP uses it too.

```
1. Evade      miss if roll < min(evadeCap, E / (E + w × A))
              E = defender Evasion, A = attacker Accuracy, w = accuracy weight
2. Block      blocked if roll < min(blockCap, block chance)
3. Damage     physical × (blocked ? 0.5 : 1)
            + magic    × (1 − magic resist %)
            + element  × (1 − that element's resist %)
4. Armor      × K / (K + max(0, armor)),  K = K₀ + K₁ × attacker level
5. Critical   × max(1, critical damage / 100) on a critical roll
6. After      the attacker heals lifesteal % × final damage
              the defender reflects thorns % × final damage to the attacker
```

Resistance percentages are clamped to −100 … cap. Today, by contrast, evasion
depends on the attacker's style, armor covers only physical damage, Magic
Resist only magic damage, elemental damage skips armor, and block halves every
damage type.

## Armor

- `reduction = armor / (armor + K)` with `K = K₀ + K₁ × attacker level`.
  Defaults: K₀ = 50, K₁ = 3.
- K is the armor that halves damage against an attacker of that level.
  Effective health is `health × (1 + armor / K)`, so every armor point adds
  the same survivability; only the displayed percentage flattens.
- Attacker level:
  - A monster hitting a character uses the content's level. Dungeons use
    `max(dungeon.requiredLevel, location.requiredLevel)`, which
    `startDungeonRun` already computes. Hunting uses the hunting ground's
    location `requiredLevel`. Add `Creature.level` only if one creature must
    hit differently in different places.
  - A character hitting a monster uses the character's level when the run
    starts.
  - A player hitting a player uses the attacker's level.
- Resolve both K values when the activity starts and store them: dungeons in
  `combatSnapshot`, hunting in `riskConfig`. Both are JSON columns, so no
  migration is needed for this.
- Authoring budgets, to show in the admin item and creature editors:
  - An on-level full armor set carries about `K(L)` armor, which gives 50%.
  - A monster that should shrug off a share `r` of a same-level character's
    damage needs `K(L) × r / (1 − r)` armor.
- Gear above the budget is fine and intended for endgame: 2 × K gives 67%,
  4 × K gives 80%, and nothing reaches 100%. Higher-level content raises K,
  which is what makes that gear necessary.
- If stat budgets later grow faster than linearly, give K the same shape. The
  leveling curve formula in `src/game/balance/curve.ts` (power, growth %,
  bands) can be reused. K has to grow the way gear armor grows, or mitigation
  drifts toward 0% or 100% again.

Why this shape: the reference games all use `X / (X + K)`. League of Legends
uses K = 100, which works because a match ends around level 18 and armor stays
small. Genshin Impact uses K = 500 + 5 × attacker level, which equals the DEF
of an enemy of the same level, so equal levels always meet at exactly 50%.
World of Warcraft classic uses 400 + 85 × attacker level, with a 75% cap.
Aergyle follows Genshin: K tracks the armor an on-level target is expected to
carry. The default line came from the armor sets in `prisma/content` (about
51.5 + 3.13 × level), but those are placeholders. From now on content is
authored to K, not the other way round.

## Resistances

- Magic Resist changes from a rating to a percentage, like Fire, Cold,
  Lightning and Poison. Each resistance reduces only its own damage type, on
  top of armor.
- Caps: 75% in PvE and 30% in PvP, both in /admin. The floor stays −100%,
  which lets a monster show a weakness: at −25% Magic Resist it takes 1.25×
  magic damage.
- Base growth matches the elements: +0.1 per level, up to +10.
- Elemental damage now goes through armor too. No creature in the content
  packs deals magic or elemental damage yet, so nothing existing changes.
- Author Magic Resist on gear in small steps, a few percent per piece, so
  reaching the cap costs real slots.

### Worked example: a wizard against Magic Resist

Level 50, so K = 200. A wizard lands 100 magic damage; a warrior lands 100
physical damage.

| Defender | Wizard today | Wizard, plan, PvE (cap 75%) | Wizard, plan, PvP (cap 30%) |
| --- | --- | --- | --- |
| 100 armor, no Magic Resist | 100 | 66.7 | 66.7 |
| 100 armor, 50% Magic Resist (today: 50 as a rating) | 66.7 | 33.3 | 46.7 |

The warrior deals 50 to both defenders today and 66.7 to both in the plan,
because Magic Resist does nothing against physical damage.

The defender with Magic Resist takes less from the wizard, which is what the
stat is for. The defender without it is never defenseless: armor still stops
a third of the hit. The gap is bounded by the cap: at most 1.43× in PvP
(30%), 2× at 50% and 4× at 75%. Today the gap has no bound (300 armor and no
Magic Resist takes 25 from the warrior and 100 from the wizard), and armor
does nothing against magic.

The cap is the dial for how strongly Magic Resist counters a magic build.

## Block

Block halves physical damage only. Shields answer weapons and Magic Resist
answers spells, so each damage type has exactly one bounded counter. Keep the
75% cap in PvE and consider 50% in PvP.

## Evasion and Accuracy

- Merge `EVASION_MELEE`, `EVASION_RANGED` and `EVASION_MAGIC` into one
  `EVASION` rating. A creature's attack style stays as flavour.
- Accuracy is the counter:
  `evade chance = min(evadeCap, E / (E + w × A))`, with accuracy weight
  w = 4 and a 50% cap, both in /admin.
  - Evasion equal to the attacker's accuracy dodges 20%; twice as much dodges
    33%; four times as much reaches the 50% cap.
  - Only the ratio matters, so it keeps working however large the numbers
    grow.
- Both become level-scaled ratings instead of capped percentages. Suggested
  growth: Accuracy 10 + 1 per level, Evasion 5 + 0.5 per level, with no bonus
  cap. Two ungeared characters of any level then dodge each other about 11% of
  the time.
- Creatures get an `accuracy` column (defaulting from their level), and their
  `evasion` becomes a rating.
- Authoring helpers: the evasion that gives dodge `d` against accuracy `A` is
  `d / (1 − d) × w × A`; the accuracy that brings evasion `E` down to dodge
  `d` is `E × (1 − d) / (d × w)`.

## Attack speed

- Only the main-hand weapon sets attack speed, and rarity doesn't scale it.
  Both are already true. Its level growth becomes 0.
- Non-weapon items don't carry attack speed; the admin item editor should
  warn when one does.
- Show weapons as damage per round: average damage × attack speed.
- Reason: a flat +0.4 makes a 0.55 weapon 73% faster but a 1.0 weapon only
  40% faster, and in the dungeon resolver speed is simply a second damage
  multiplier.

## Critical hits

No change. Chance is a percentage capped at 100; the multiplier is
`critical damage / 100` (base 150). Cap crit chance per item with `maxValue`.

## Lifesteal (when gear gets it)

- The attacker heals `lifesteal % × final damage` of each landed hit, up to
  maximum health. Thorns damage doesn't trigger it.
- Caps to start with: 30% in PvE, 15% in PvP.
- It only matters where the character attacks: dungeons and PvP. Hunting has
  no character strikes.

## Thorns (when gear gets it)

- The defender reflects `thorns % × final damage` of each landed hit to the
  attacker. It is a percentage rather than a flat number, so attack speed
  doesn't change its value and it keeps scaling with content. Change its
  display format from a number to a percentage.
- Reflected damage isn't mitigated again, can't be evaded or crit, and is
  never reflected back.
- Caps to start with: 30% in PvE, 15% in PvP. With equal caps, lifesteal and
  thorns cancel each other out between two players.
- In dungeons it hits every monster that strikes the character, which suits
  armored builds facing packs. Hunting creatures have no health in the
  resolver, so thorns does nothing there.

## Stat list after the plan

| Stat | Plan |
| --- | --- |
| Physical damage, Magic damage | Keep |
| Critical chance, Critical damage | Keep |
| Attack speed | Main-hand weapon only |
| Accuracy | Rating; counters Evasion |
| Armor | Keep; reduces every hit |
| Magic Resist | Percentage resistance |
| Evasion (melee, ranged, magic) | One rating |
| Block | Physical hits only |
| Fire, Cold, Lightning, Poison resist | Keep |
| Health, Health regen | Keep |
| Mana, Mana Regen | Remove |
| Prayer Points | Hidden until read |
| Movement speed, Luck, Carrying capacity | Keep |
| Gold Find | Hidden until creatures drop gold |
| Experience Gain | Remove |
| Lifesteal, Thorns | Keep; wire in with the rules above |
| Five vocation efficiencies | Keep |

The 33 player-facing stats become 26 visible ones, plus 2 hidden until used.

## Other curves

- **Vocation efficiency** already has the right shape:
  `base × 100 / (100 + efficiency)`, so 100 efficiency halves the time. Move
  the 100 into /admin.
- **Find and quantity bonuses** stay linear up to a knee, then saturate:
  `bonus = X` up to the knee, then `knee + (M − knee) × E / (E + M − knee)`
  with `E = X − knee` and ceiling `M`. Find: knee 75%, ceiling 200%.
  Quantity: knee 50%, ceiling 150%. Negative find stays linear with its −50%
  floor. The slope is continuous at the knee, so current players see no
  change.
- **XP boosts** add: `1 + Σ(boost − 1)` over stackable boosts, then the
  largest non-stackable one. Today five ×1.5 boosts multiply to ×7.6.
- **Luck's description** should say it raises find chance and quantity. It
  currently says "Increases item drop quality".
- **The character sheet** should show Armor with its reduction against a
  same-level enemy. The row is commented out today.

## PvP (not built)

- One resolver: each side's stat snapshot plays the monster's role for the
  other.
- Level brackets, for example ±5 levels. K comes from the attacker's level.
- A PvP config row: resistance cap 30%, block cap, lifesteal and thorns caps,
  a damage multiplier around ×0.5 so a duel lasts 8–15 rounds and one
  critical hit doesn't decide it, and a round limit that ends in a draw.
- Show the opponent's level and damage type before a challenge, and let
  players save a defensive loadout.
- Remove or admin-gate `/api/test/add-item` before PvP or launch. Any
  signed-in player can use it to grant themselves any item.

## Implementation order

### Phase 1: mitigation (no stat enum changes)

1. In `src/server/combat/rules.ts`, add one strike function used in both
   directions, following "One hit, in order". `protectionMultiplier` takes K;
   add `armorConstant(level, config)`. `characterStrike` in
   `src/server/dungeons/resolver.ts` switches to the shared function.
2. Add a `CombatConfig` singleton row (id 1, like `HuntingConfig` and
   `DungeonConfig`) with K₀, K₁, the resistance caps for PvE and PvP, the
   block and evasion caps, the accuracy weight, and the lifesteal and thorns
   caps, edited in /admin. Code defaults apply when the row is missing. This
   is a new table, so it needs a migration; ask the owner before applying any
   migration.
3. Snapshots: store `rules: 2`, the monster-side K and the character-side K
   in the dungeon `combatSnapshot` and the hunting `riskConfig`. A snapshot
   without `rules: 2` resolves with today's formulas, so runs already
   underway are unaffected.
4. Magic Resist as a percentage: its caps in `calculateFinalStatsFromTotals`,
   its default growth (+0.1 per level, max +10) and its `STAT_METADATA`
   format. Re-author creature and item Magic Resist values.
5. Pass the config into the admin simulators (`src/game/balance/combat.ts`,
   `src/server/dungeons/simulator.ts`), the dungeon planner and the creature
   editor, and show "reduction at level" and the authoring budgets there.
6. Tests in `tests/dungeons.test.ts`, `tests/hunting.test.ts` and
   `tests/balance.test.ts`: K at armor 0, K and 9K; which level sets K; the
   legacy snapshot path; block on physical damage only; the resistance caps.

### Phase 2: stat list (Prisma enum migration)

1. `StatType`: add `EVASION`; remove `EVASION_MELEE`, `EVASION_RANGED`,
   `EVASION_MAGIC`, `MANA`, `MANA_REGEN` and `EXPERIENCE_GAIN`. MySQL rejects
   the enum change while rows still use a removed value, so first migrate or
   delete the rows in `ItemStat`, `ItemStatProgression`, `StatRarityOverride`,
   `UserItemStatModifier`, `FoodEffectStat`, `CharacterStatGrowth` and
   `CharacterBaseStat`. Merged Evasion takes the largest of the three old
   values.
2. Evasion against Accuracy: `Creature.accuracy`, creature evasion as a
   rating, the growth defaults above, and the shared strike function.
3. Remove the dropped stats from `ComputedStats`, `COMPUTED_STAT_TYPE_MAP`,
   `STAT_METADATA`, the UI and the content packs.
4. Hide Prayer Points and Gold Find in item tooltips until they're read.
5. Ask the owner before applying the migration.

### Phase 3: economy curves

1. Additive XP boosts in `combineMultipliers` (`src/utils/leveling.ts`).
2. The find and quantity knee in `calculateExpeditionRewardModifiers`
   (`src/server/expeditions/rewards.ts`), with its parameters snapshotted:
   hunting `riskConfig`, dungeon `combatSnapshot`, and a new nullable JSON
   column for gathering.
3. The vocation efficiency constant in /admin.

### Phase 4: lifesteal and thorns, then PvP

Wire lifesteal and thorns into the shared strike function when the first
items carry them, then build PvP on the same resolver.
