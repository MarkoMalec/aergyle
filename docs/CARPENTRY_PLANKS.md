# Carpentry plank pack v1

This pack adds one stackable `MATERIAL` plank and one Carpentry recipe for
every `LOG` item in the live catalog. Each recipe consumes one matching log and
produces one plank. Recipes are available at every configured location; the
Carpentry skill level remains the progression gate.

Definitions live in
[`prisma/content/carpentry.ts`](../prisma/content/carpentry.ts), and the
idempotent importer is
[`scripts/seedCarpentry.ts`](../scripts/seedCarpentry.ts).

| Output          | Input           | Level | Rarity    | Seconds |  XP | Value |
| --------------- | --------------- | ----: | --------- | ------: | --: | ----: |
| Oak Plank       | 1 Oak Log       |     1 | Common    |      12 |   3 |     3 |
| Birch Plank     | 1 Birch Log     |     1 | Common    |      12 |   3 |     3 |
| Pine Plank      | 1 Pine Log      |     1 | Common    |      12 |   3 |     5 |
| Willow Plank    | 1 Willow Log    |    10 | Common    |      20 |   7 |    10 |
| Ash Plank       | 1 Ash Log       |    40 | Uncommon  |      32 |  14 |    28 |
| Frostpine Plank | 1 Frostpine Log |    50 | Uncommon  |      40 |  19 |    50 |
| Elderwood Plank | 1 Elderwood Log |    80 | Rare      |      56 |  28 |   110 |
| Gloamwood Plank | 1 Gloamwood Log |   110 | Exquisite |      70 |  35 |   175 |
| Emberwood Plank | 1 Emberwood Log |   150 | Epic      |      78 |  45 |   240 |
| Ironbark Plank  | 1 Ironbark Log  |   175 | Elite     |      96 |  55 |   460 |
| Saltcedar Plank | 1 Saltcedar Log |   210 | Legendary |     120 |  75 | 1,000 |

## Artwork

- Generator: built-in ImageGen, one edit request per species.
- Direction: Wayfarer's Atlas faceted inventory sprites.
- Canonical geometry reference:
  `art/items/carpentry-v1/basic-plank-master.png`.
- Archive: `art/items/carpentry-v1` contains the initial masters and prompt
  record; `art/items/resource-expansion-v2` contains the three added plank
  masters alongside their matching logs and prompt record.
- Runtime: eleven 256 x 256 RGBA PNGs under
  `public/assets/items/resources/planks`.
- Export: every runtime subject occupies a 210 px long dimension on centered
  transparent padding. Rarity framing remains a UI responsibility.

The generic Basic Plank is retained only as the canonical art reference; it is
not a ninth catalog item.

## Import and verification

The matching log templates must exist before applying the pack. The importer
does not recreate or overwrite source logs.

```sh
npm run db:seed:carpentry -- --check
npm run db:seed:carpentry -- --apply
npm run db:seed:carpentry -- --verify
npm test
```

`--check` is read-only. `--apply` creates or updates the eleven plank templates,
their one-log Carpentry recipes, and their location links. `--verify` checks the
stored catalog and recipe state against the source definitions.
