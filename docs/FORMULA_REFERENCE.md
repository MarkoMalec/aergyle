# Formula reference

Every formula the game runs, grouped by system, **as of 30 September 2026**
(branch `current-gear-balancing`, with phase 1 of the combat plan). This page
describes the code as it is. Planned changes are in
[COMBAT_BALANCE_DESIGN.md](COMBAT_BALANCE_DESIGN.md); read its principles
before changing any of these. Update this page whenever a formula changes.

Shapes used below:

- **Saturating**: `X / (X + K)`. Each point adds the same survivability or
  output, and the percentage never reaches 100%.
- **Capped**: linear, then a hard cap.
- **Linear**: flat and uncapped.
- **Compounding**: grows faster and faster (powers, exponents, products).
- **Procedure**: a rule, a loop or a random roll.

Function names are stable; file paths are given for searching.

## Character stats

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| Base stat by level | `level-1 value + min(cap, per level × (level − 1))` | Capped | `getLevelStatBonus`, `DEFAULT_LEVEL_GROWTH` in `src/utils/stats.ts`; edited at /admin/character-stats |
| Stat total | `base + equipment + active food or potion`, all flat | Linear | `getCharacterStatSnapshot` in `src/server/stats.ts` |
| Final caps and floors | crit ≤ 100; evasion, block ≤ 75; Magic Resist and elemental resistances −100…75; attack speed ≥ 0.1; lifesteal ≤ 100; health ≥ 1 | Capped | `calculateFinalStatsFromTotals` in `src/utils/stats.ts` |
| Item stat at a rarity | `min(max value, base × rarity) + instance modifiers` | Linear | `scaleItemStat`, `resolveEffectiveItemStats` in `src/utils/itemInstanceStats.ts` |
| Weapon attack speed | main-hand speed replaces the unarmed 1.0; level growth, other gear and food add on top | Linear | `weaponAttackSpeedAdjustment` in `src/utils/stats.ts`; `statScalesWithRarity` in `src/utils/itemInstanceStats.ts` |
| Carrying capacity | `25 + floor(carrying capacity)` slots | Linear | `calculateInventoryCapacity` in `src/utils/inventoryCapacity.ts` |

Default level growth (used when /admin has no saved rule): health 100 + 5 per
level, physical damage 1–5 + 0.2/0.3, armor + 0.5, Magic Resist + 0.1 (up to
+10), crit chance 5% + 0.1 (up to +10), crit damage 150% + 0.5 (up to +50),
attack speed 1.0 + 0.004 (up to +0.4), accuracy 10 + 0.2 (up to +20), each
evasion 5% + 0.1 (up to +10), each elemental resistance + 0.1 (up to +10),
health regen 1 + 0.05, mana 50 + 2, mana regen 1 + 0.02. Economy and vocation
stats don't grow. The live rules differ: health grows 10 per level, health
regen is 0.001 + 0.001 per level, and the content pass set attack speed
growth to 0 and Magic Resist to + 0.1 (up to +10).

Rarity multipliers (`RarityConfig`, defaults in `src/utils/rarity.ts`):
Worthless 0.5, Broken 0.75, Common 1.0, Uncommon 1.15, Rare 1.35,
Exquisite 1.5, Epic 1.7, Elite 1.9, Unique 2.1, Legendary 2.3, Mythic 2.7,
Divine 3.0. They apply to every stat, percentages included, unless a per-item
override or `maxValue` says otherwise.

## Combat

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| Armor K | `K = armorK0 + armorK1 × attacker level` (50 and 3 by default): the armor that halves that attacker's damage | Linear | `armorConstant` in `src/server/combat/rules.ts`; `CombatConfig`, edited on /admin/character-stats |
| Armor | `damage × K / (K + max(0, armor))`, on every hit: physical, magic and elemental | Saturating | `protectionMultiplier`, `mitigateStrike` in `src/server/combat/rules.ts` |
| Magic Resist, elemental resistances | `damage × (1 − clamp(resist, −100, 75) / 100)`, on their own damage type, on top of armor | Capped | `mitigateStrike` in `src/server/combat/rules.ts` |
| Evasion, block, critical chance | `clamp(stat, 0, cap) / 100`; caps 75, 75, 100. Block halves physical damage only | Capped | `percentChance`, `mitigateStrike` in `src/server/combat/rules.ts` |
| Critical damage | `hit × max(1, critical damage / 100)` | Linear | `criticalMultiplier` in `src/server/combat/rules.ts` |
| Creature hits a character | evasion for the attack style → block roll → `(physical × (blocked ? 0.5 : 1) + magic × (1 − MR%) + element × (1 − resist%)) × K / (K + armor)` → crit. K from the content's level: the dungeon's, or the hunting ground's location | Procedure | `resolveCreatureStrike` in `src/server/combat/rules.ts` (dungeons and hunting retaliation) |
| Character hits a monster | monster evasion → the same mitigation with the monster's armor, Magic Resist and block, K from the character's level → crit | Procedure | `resolveCharacterStrike` in `src/server/combat/rules.ts` |
| Rules in a snapshot | runs store their K values (`combatSnapshot.rules`, `riskConfig.strikeRules`); a run without them uses the original model: K = 100, armor against physical only, Magic Resist as a rating, block on any hit | Procedure | `parseStrikeRules`, `parseDungeonCombatRules` |
| Dungeon rounds | each round the character strikes `attack speed` times (0.1–10, fractions carry over) and every engaged monster strikes once; pack size 1–10; lost after 10,000 rounds | Procedure | `resolveDungeonRun` in `src/server/dungeons/resolver.ts` |
| Dungeon defeat | each looted stack survives with chance 0.35 and keeps 25% of its quantity (at least 1) | Procedure | `applyDungeonDeathPenalty`; `DungeonConfig` defaults in `src/server/dungeons/service.ts` |
| Dungeon entry | level ≥ `max(dungeon level, location level)` and health ≥ 25% | Procedure | `startDungeonRun` in `src/server/dungeons/service.ts` |
| Recommended health | 90th-percentile damage over 200 seeded runs, + 1 | Procedure | `estimateRecommendedHealth` in `src/server/dungeons/simulator.ts` |
| Hunting danger | `danger = clamp(duration danger × global danger, 0, 10)`; attack chance `clamp(creature attack chance × danger, 0, 0.95)` per encounter roll | Capped | `resolveHuntingExpedition` in `src/server/hunting/resolver.ts` |
| Hunting damage budget | total ≤ max health × 30%; health never below `max(1, 5% of max)` | Capped | `resolveHuntingExpedition`; `calculateHealthAfterDamage` in `src/server/combat/healthMath.ts`; `HuntingConfig` |
| Hunting mishaps | `clamp(mishap chance × danger × clamp(1 − (speed − 100) × 0.005, 0.5, 1.5), 0, 0.95)` | Capped | `resolveHuntingExpedition` in `src/server/hunting/resolver.ts` |

Hunting never fights: every encounter is a kill, and only the animal's attack
profile matters. Creature armor, Magic Resist, evasion and block are used in
dungeons only.

## Loot and expeditions

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| Find bonus | `clamp(0.5 × (skill − 1) + 0.4 × luck + efficiency, −50, 150)`, luck first clamped to −100…250 and efficiency to 0…250 | Capped | `calculateExpeditionRewardModifiers` in `src/server/expeditions/rewards.ts` |
| Quantity bonus | `clamp(0.2 × (skill − 1) + 0.1 × max(0, luck) + 0.5 × efficiency, 0, 100)`; scale `clamp(duration multiplier, 0.1, 20) × (1 + bonus)` | Capped | same function |
| Drop chance | `clamp(base chance × (1 + find bonus), 0.001, 0.95)`, each drop rolled on its own | Capped | `calculateExpeditionEffectiveFindChance` in `src/server/expeditions/rewards.ts` |
| Drop quantity | `max(1, round(random(min…max) × quantity scale))` | Procedure | `rollDropQuantity` in `src/server/creatures/loot.ts` |
| Gathering | per duration: N rolls × every pool entry; an empty result gives one weighted fallback item | Procedure | `calculateGatheringRewards` in `src/server/gathering/rewards.ts` |
| Dungeon loot | the find and quantity rules with skill 1 and efficiency 0, so only Luck counts | Capped | `resolveDungeonRun` in `src/server/dungeons/resolver.ts` |
| Garden harvest | per tile `random(yield min…max)`; tiles finish one after another | Procedure | `src/server/garden/service.ts`, `countFinishedHarvestTiles` in `src/server/garden/harvestSchedule.ts` |

Content durations (`prisma/content/gathering.ts`, `prisma/content/hunting.ts`,
editable in /admin): gathering 1–4 hours gives 3/5/7/9 rolls, quantity
×1/1.15/1.35/1.6 and 18/40/66/96 XP; hunting gives 2/4/6/8 rolls,
×1/1.12/1.28/1.48, danger 0.8/1/1.12/1.25 and 20/46/78/116 XP.

## Vocations and travel

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| Action time | `max(1, round(base × 100 / (100 + efficiency)))`; 100 efficiency halves the time | Saturating | `computeEffectiveUnitSeconds`, `VOCATION_EFFICIENCY_HALF_TIME` in `src/game/vocationStats.ts` |
| Units, XP and items | `units = floor(elapsed / unit seconds)`; XP = units × XP per unit; items = units × yield per unit; capped by materials, bait and bag space; runs last at most 8 hours | Linear | `computeVocationalProgress` in `src/server/vocations/progress.ts`; `src/server/vocations/claim.ts`; `MAX_VOCATION_DURATION_SECONDS` |
| Travel time | `max(1, round(base × 100 / max(10, movement speed)))`; routes without a saved time take 4 hours | Saturating | `applyMovementSpeed` in `src/game/world/travel.ts` |

## Health and consumables

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| Regeneration | `min(max, current + seconds × regen)`; the default growth keeps a full heal from zero at 100 seconds at every level | Capped | `resolveRegeneratedHealth` in `src/server/combat/healthMath.ts` |
| Healing potions | `min(max, current + healing)`: 30, 75, 150, 325, and 750 for the Trollblood Elixir | Capped | `src/server/food-effects/service.ts` |
| Food, potions, elixirs | one active effect per character; its flat stats last its effect seconds; a new one replaces it | Linear | `src/server/food-effects/service.ts` |

## Progression

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| XP to the next level | `floor(first-level XP × L^power × (1 + growth%)^(L − 1) × bands)`, at least 1; defaults character 5 × L^1.5 and skills 50 × L^1.5, up to level 2,000 | Compounding | `stepXp`, `buildCurve` in `src/game/balance/curve.ts`; designed at /admin/leveling |
| Level from XP | highest level whose cumulative total ≤ lifetime XP; curve edits reach every process within 30 seconds | Procedure | `levelForTotalXp` in `src/utils/xpCurve.ts` |
| XP boosts | `floor(base × product of stackable boosts × largest non-stackable)`; five ×1.5 boosts give ×7.6 | Compounding | `combineMultipliers`, `awardXp` in `src/utils/leveling.ts` |
| Skill XP | the skill curve; boosts don't apply | Compounding | `awardTrackXp` in `src/utils/progression.ts` |
| Activity XP | vocations: units × XP per unit; expeditions: flat per duration; dungeons: flat per run. Vocations and expeditions give the character and the skill the same base amount; dungeons give character XP only | Linear | `src/server/vocations/claim.ts`, `src/server/hunting/service.ts`, `src/server/dungeons/service.ts` |

## Economy

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| Market tax | `tax = round(gross × 12%)`; the seller receives gross − tax | Linear | `calculateMarketSale`, `MARKET_TAX_RATE` in `src/lib/marketplace.ts` |
| NPC buy price | item base price × quantity; rarity doesn't change it | Linear | `npcBuyPrice` in `src/server/settlements/shop.ts` |

## Admin balance tools

| Rule | Formula | Shape | Where |
| --- | --- | --- | --- |
| Item power | weapons: average damage × attack speed; armor: armor + Magic Resist | Linear | `itemPower` in `src/game/balance/combat.ts` |
| XP per hour | `XP per action × 3,600 / seconds per action` | Linear | `xpPerHour` in `src/game/balance/sources.ts` |
| Garden XP per day | cycles = `min(check-ins, 86,400 / grow seconds)`; XP = tiles × XP × cycles | Capped | `gardenPlan` in `src/game/balance/sources.ts` |
| Lowest surviving level | binary search for the level whose survival rate reaches the target | Procedure | `lowestSurvivingLevel` in `src/game/balance/combat.ts` |

## Stats nothing reads yet

Accuracy, Lifesteal, Thorns, Mana, Mana Regen, Prayer Points, Gold Find and
Experience Gain are defined and can appear on gear, but no gameplay code reads
them. See [COMBAT_BALANCE_DESIGN.md](COMBAT_BALANCE_DESIGN.md) for which stay,
which go, and how the kept ones should work.
