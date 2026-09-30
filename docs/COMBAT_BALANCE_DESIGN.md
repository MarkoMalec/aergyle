# Combat and stat balance plan

**Status: phase 1 is implemented; phases 2-4 are planned.** Agreed with the
game's owner on 30 September 2026. Phase 1 (armor against every hit with a
level-scaled K, Magic Resist as a capped percentage, block on physical hits
only) and the first real content pass ("Budgets" below) were built on the
branch `current-gear-balancing`. [FORMULA_REFERENCE.md](FORMULA_REFERENCE.md)
lists every formula as it runs. When a later part lands, describe it in the
system docs ([CHARACTER_STATS_SYSTEM.md](CHARACTER_STATS_SYSTEM.md),
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

- Target reduction for on-level armor. Built at 50% (K₀ = 50, K₁ = 3); 60%
  would be K₀ = 33, K₁ = 2, both editable on /admin/character-stats. Gear
  budgets are derived from K, so changing it means re-running the content
  pass.
- Resistance caps. 75% applies everywhere today (`RESISTANCE_CAP`); 30% is
  the planned PvP cap. The cap decides how strongly a Magic Resist stacker
  counters a magic build.
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
- Caps: 75% (`RESISTANCE_CAP`, a code constant for now); PvP will need its
  own, lower cap of about 30%. The floor stays −100%, which lets a monster
  show a weakness: at −25% Magic Resist it takes 1.25× magic damage.
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
  The content pass also set its level growth to 0 and took it off the three
  pairs of gloves that had it.
- Non-weapon items don't carry attack speed; the admin item editor should
  warn when one does (not built yet).
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

## Budgets: authoring gear and monsters by level

`src/game/balance/budget.ts` defines what gear and monsters of a level
should carry. Item values are Common-equivalent, the way `ItemStat` stores
them; an item's rarity multiplies them.

- **Armor.** A full on-level heavy set at Rare, plus the level's base armor,
  equals K: `set armor (Common) = (K(L) − base armor(L)) ÷ 1.35`. Slots take
  fixed shares (chest 25%, greaves 18%, head 13%, pauldrons 11%, boots 9%,
  bracers, gloves and belt 8% each), and material scales them (heavy 1,
  medium 0.85, light 0.45). A shield carries 15% of a set.
- **Weapons.** Damage per round (average damage × attack speed) is
  `6 + 1.4 × (level − 1)` for a one-handed weapon and 1.3 times that for a
  two-handed one. The weapon keeps its own attack speed, so a fast weapon
  hits for less each time.
- **Secondary stats** share an item's budget. Each stat has a value at the
  item's level for an item that carries only that stat: for example 2-5%
  critical chance, 3-8% Magic Resist, 4-10% elemental resistance, or 4.4% of
  base health. Bigger pieces carry more (a chest 2×, gloves 0.64×, weapons
  1.5-2×, jewelry 1×). Several stats split the budget with a small bonus per
  extra stat, so two stats get 75% each and three get 67%. Percentage stats
  reach their ceiling at `CONTENT_LEVEL_CAP` (340) and are capped per item at
  twice their value (`maxValue`), so rarity can't push them into the hard
  caps.
- **Monsters.** A reference character of the level (1.3 × base health, armor
  equal to K, a Rare on-level weapon) kills a normal monster in about four
  rounds. Monster armor is a share of K: normal 0.25 K (20%), elite 0.35 K,
  boss 0.5 K (33%). Rank multiplies health and damage: fodder 0.5 and 0.4,
  elite 2.5 and 1.3, boss 8 and 1.8. Dungeons field different numbers of
  monsters, so damage is then calibrated per dungeon: `scripts/rebalanceGear.ts`
  finds one damage scale for each dungeon's own monsters so an on-level
  reference character clears it 75% of the time (65% with a boss).
- **Dungeons are the risky, rewarding activity.** They start at level 35,
  after players have geared up in the open world, and a run takes 2-6 hours.
  Being on level in on-level Rare gear isn't enough to be safe: 10 levels
  over, or better gear, makes a run near-certain. A run pays
  `2.5 × (1,300 + 6 × level)` XP per hour, about 2.5 times what the best
  vocations pay around that level, and a defeat pays no XP and keeps little
  loot. The planner's recommended health (enough for 90% of runs) is how a
  player judges whether to go in.
- **Hunting.** An animal hits for `0.12 × (0.5 + attack chance) × reference
  health` at its home level, the lowest location level it roams. A mishap
  costs 2% of reference health at the ground's location level.

### The level-340 content pass (30 September 2026)

`scripts/rebalanceGear.ts` placed every existing piece of gear, every monster
and every dungeon on this ladder. Levels follow the world map. The gaps
between tiers are deliberate: that's where new gear goes.

| Level | Gear | Dungeon |
| --- | --- | --- |
| 1 | Wooden weapons, Buckler, Trailwarden set, Fieldweave (1-12), Ironroot Band, Pilgrim's Bronze Ankh | |
| 5-10 | Tin Sword, Leather Belt, Wayfarer Shortblade, Tinker's Brass Signet, Rowan Bead Necklace | |
| 15 | Gold set and Gold jewelry | |
| 20-30 | Bearded Greataxe, Iron Shield, Briarcleaver, Mossweave (gathering) | |
| 35-40 | Ironbark set | Gloamvault, Crownhold (35, 2 h) |
| 60 | Reedwind Bow, Fordstone Talisman | Gloamvault, Valedor (60, 3 h) |
| 100-120 | Frostsilver set, Ogre Cleaver, Cindermaul | Blackjaw Stockade (100, 4 h) |
| 150-180 | Dragonscale Shoulder Pads, Cinderweave set | Drowned Mouth Grotto (180, 5 h) |
| 200-260 | Silver Revolver, Diamond Ring, Duskglass Staff | |
| 300 | Duskwarden set | Trollbreaker Cavern (300, 6 h) |
| 340 | Embervein Sword | |

Monsters that aren't in a dungeon yet got levels for dungeons in the gaps:
Puddle Slime 45, Mire ooze 80, Bat 130, Carrion Hound 150, Cavefang Spider
230, Rattlebone Skeleton 260. Crafting recipes kept their skill levels. On the live curves
they already cost about as much XP as the character levels their gear now
sits at: skill 20 ≈ character 35, 65 ≈ 124, 105 ≈ 208.

To add gear, pick a level in a gap, choose the slot, material and secondary
stats, and take the numbers from `budgetItemStats`; the script shows how. For
a new monster, start from `monsterBudget` for its level and rank, then tune
its damage against the dungeon's population in the admin dungeon preview.

The plan the script applies, with before and after values and the dungeon
and hunting simulations, is `prisma/rebalance/plan.json`. `--apply` first
saves every row it replaces to `prisma/rebalance/backup-*.json`.

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

### Phase 1: mitigation (done, 30 September 2026)

- `resolveCreatureStrike` and `resolveCharacterStrike` in
  `src/server/combat/rules.ts` share `mitigateStrike`, which follows "One
  hit, in order" (evasion is still chosen by attack style until phase 2).
  The dungeon resolver's own `characterStrike` is gone.
- `CombatConfig` (id 1: `armorK0`, `armorK1`, migration
  `20260930120000_combat_config`) is edited on /admin/character-stats under
  "Armor against each level". Without a row, `DEFAULT_COMBAT_CONFIG` (50, 3)
  applies. The resistance, block and evasion caps are still code constants.
- Snapshots carry the rules: dungeon `combatSnapshot.rules` holds
  `{ incoming, outgoing }` and hunting `riskConfig.strikeRules` holds one
  `StrikeRules`. A snapshot without them resolves with the original model
  (`LEGACY_STRIKE_RULES`, version 1), so runs started before the change are
  unaffected.
- Magic Resist is capped at −100…75, grows 0.1 per level up to +10, and
  displays as a percentage. Creatures accept −100…75 (negative is a
  weakness).
- The admin dungeon preview, the hunting simulator and /admin/simulations
  resolve with the same rules, and the dungeon planner shows how much damage
  the player's armor stops in each dungeon.
- Tests: `tests/combat-rules.test.ts` and `tests/budget.test.ts`.

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
