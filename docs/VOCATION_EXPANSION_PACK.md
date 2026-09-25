# Atlas vocation expansion v1

This additive content pack introduces 24 new vocation resources: six each for Mining, Woodcutting, Fishing and Blacksmithing. Definitions live in [`prisma/content/vocationExpansion.ts`](../prisma/content/vocationExpansion.ts); the idempotent importer is [`scripts/seedVocationExpansion.ts`](../scripts/seedVocationExpansion.ts).

## Locations and access

The six placeholder landmarks from the world atlas are now database-backed locations with enforced player-level requirements. Resource actions also retain their separate vocation-skill requirement.

| Location          | Player level | New resources                                                                                     |
| ----------------- | -----------: | ------------------------------------------------------------------------------------------------- |
| Citadel           |            1 | Copper Ore, Tin Ore, Pine Log, Willow Log, Silver Minnow, River Trout, Copper Ingot, Bronze Ingot |
| Goblins Camp      |           40 | Silver Ore, Ash Log, Bog Pike, Steel Ingot                                                        |
| Frostcrown Peaks  |           50 | Frostsilver Ore, Frostpine Log, Frostscale Char, Frostsilver Ingot                                |
| Ruins of Caldrath |           80 | Cobalt Ore, Elderwood Log, Caldrath Eel, Cobalt Ingot                                             |
| Mount Doom        |          150 | Obsidian Ore, Emberwood Log, Doomsteel Ingot                                                      |
| Pirate Island     |          200 | Blackfin Tuna                                                                                     |

Citadel also exposes the existing Coal and Iron ore resources. Existing locations and resource records remain in place.

## Progression balance

| Skill         | Resource progression (required skill level)                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Mining        | Copper Ore (1), Tin Ore (10), Silver Ore (40), Frostsilver Ore (50), Cobalt Ore (80), Obsidian Ore (150)                |
| Woodcutting   | Pine Log (1), Willow Log (10), Ash Log (40), Frostpine Log (50), Elderwood Log (80), Emberwood Log (150)                |
| Fishing       | Silver Minnow (1), River Trout (10), Bog Pike (40), Frostscale Char (50), Caldrath Eel (80), Blackfin Tuna (200)        |
| Blacksmithing | Copper Ingot (1), Bronze Ingot (10), Steel Ingot (40), Frostsilver Ingot (50), Cobalt Ingot (80), Doomsteel Ingot (150) |

Time, XP and value rise with the skill and destination thresholds. Values are an initial economy pass based on the live catalog's 5-gold Worm, 1-gold Coal and 2-gold Iron ore. They should be revisited after playtesting travel cadence, marketplace supply and tool efficiency.

## Input consumption

Fishing consumes the selected bait stack per completed catch:

| Catch                       | Worms |
| --------------------------- | ----: |
| Silver Minnow / River Trout |     1 |
| Bog Pike / Frostscale Char  |     2 |
| Caldrath Eel                |     3 |
| Blackfin Tuna               |     4 |

Blacksmithing consumes the following materials per completed ingot:

| Output            | Inputs                                    |
| ----------------- | ----------------------------------------- |
| Copper Ingot      | 2 Copper Ore + 1 Coal                     |
| Bronze Ingot      | 1 Copper Ingot + 2 Tin Ore + 1 Coal       |
| Steel Ingot       | 2 Iron ore + 3 Coal                       |
| Frostsilver Ingot | 2 Frostsilver Ore + 1 Silver Ore + 3 Coal |
| Cobalt Ingot      | 3 Cobalt Ore + 4 Coal                     |
| Doomsteel Ingot   | 2 Obsidian Ore + 1 Cobalt Ingot + 5 Coal  |

The vocation service validates one craftable unit at start, consumes inputs transactionally when rewards are claimed, limits output to available inputs and stops an activity when its selected bait or materials are exhausted.

## Artwork

- Generator: built-in image generation, one request per resource.
- Direction: the Wayfarer's Atlas faceted-field-specimen rules in [`GAME_DESIGN_SYSTEM.md`](GAME_DESIGN_SYSTEM.md).
- Archive: [`art/items/vocation-expansion-v1`](../art/items/vocation-expansion-v1) contains 24 generated masters, the exact assembled prompt set and generation metadata.
- Runtime: 24 separate 256×256 RGBA PNGs under `public/assets/items/resources/{ores,logs,fish,ingots}`.
- Export: each master is normalized to roughly 190–215px of occupied subject space on a transparent 256×256 canvas. Rarity light, shadows, labels and borders remain UI responsibilities.

## Import and verification

Apply the location-level migration before importing the pack.

```sh
npm run db:migrate
npm run db:seed:vocations -- --check
npm run db:seed:vocations -- --apply
npm run db:seed:vocations -- --verify
npm test
```

`--check` is read-only. `--apply` creates or synchronizes pack-owned items/resources, recipes and exact location assignments; it creates missing Worm, Coal or Iron ore dependencies without replacing conflicts. `--verify` checks the stored pack. New resource location assignments are intentionally exact so a high-level resource cannot leak into a beginner destination.
