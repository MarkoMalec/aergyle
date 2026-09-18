# Atlas equipment pack v1

Twenty-one items created for Aergyle's Wayfarer's Atlas art direction: five weapons and two complete eight-piece armor sets. Sprites were generated and checked before the catalog records were created. Definitions live in [atlasEquipment.ts](../prisma/content/atlasEquipment.ts).

Browse the collection at `/admin/items?collection=atlas-v1`. All 21 templates have been imported into the configured database. Re-running the importer keeps the existing records and their IDs.

## Equipment sets

| Slot      | Trailwarden — Rare, level 1 | Duskwarden — Epic, level 50 |
| --------- | --------------------------- | --------------------------- |
| Head      | Trailwarden Helm            | Duskwarden Helm             |
| Chest     | Trailwarden Jerkin          | Duskwarden Cuirass          |
| Shoulders | Trailwarden Pauldrons       | Duskwarden Pauldrons        |
| Forearms  | Trailwarden Bracers         | Duskwarden Vambraces        |
| Hands     | Trailwarden Gloves          | Duskwarden Gauntlets        |
| Waist     | Trailwarden Belt            | Duskwarden Girdle           |
| Legs      | Trailwarden Greaves         | Duskwarden Greaves          |
| Feet      | Trailwarden Boots           | Duskwarden Sabatons         |

Trailwarden combines brown leather, practical iron reinforcement and moss lining. Its stats emphasize beginner survivability, with small accuracy, speed and critical-chance bonuses. Duskwarden uses midnight steel, brass compass points and indigo lining; it offers substantially higher armor and health, additional resistances, and stronger utility bonuses.

These are coordinated armor collections; no additional set-bonus mechanic is introduced. The importer creates catalog templates. Rewards, shop stock, crafting recipes and automatic grants to player inventories are separate content decisions.

## Weapons

| Weapon              | Type  | Default rarity | Required level | Base damage    | Price |
| ------------------- | ----- | -------------- | -------------: | -------------- | ----: |
| Wayfarer Shortblade | Sword | Rare           |              1 | 5–9 physical   |   110 |
| Briarcleaver        | Axe   | Rare           |             10 | 18–29 physical |   650 |
| Reedwind Bow        | Bow   | Rare           |             20 | 30–46 physical | 1,800 |
| Cindermaul          | Mace  | Epic           |             35 | 52–78 physical | 4,600 |
| Duskglass Staff     | Staff | Epic           |             50 | 72–108 magic   | 7,800 |

All items are non-stackable, have descriptions, prices, equipment slots and base stats. Their exact stat definitions are maintained in code, rather than duplicated in this guide.

## Rarity and level behavior

Template stats are COMMON-equivalent base values. The existing instance-creation pipeline applies the selected rarity multiplier once. With the current database configuration, Rare is ×1.35 and Epic is ×1.7. For example, the Trailwarden Jerkin's 12 base armor becomes 16.2, while the Duskwarden Cuirass's 86 becomes 146.2. The current tooltip formatter displays integer armor values.

Both item-creation helpers now use the template's rarity when the caller omits an explicit rarity. Explicit rarity rolls remain supported. Item details display required level; quick equip and drag-and-drop reject gear above the character's level before changing local inventory state. The equipment API also validates required level, owned instance availability, equipment slot and duplicate instances.

The values are an initial progression pass. They have not been validated through extended combat or economy playtesting.

## Artwork and repeatability

- Generator: built-in image generation. Each selected item is a separate generated sprite.
- Art archive: [art/items/atlas-equipment-v1](../art/items/atlas-equipment-v1), containing 21 original masters, their exact prompts and [generation.json](../art/items/atlas-equipment-v1/generation.json).
- Runtime sprites: `public/assets/items/armor/*-atlas-v1.png` and `public/assets/items/weapons/*-atlas-v1.png`.
- Masters retain the generator's native 1254 × 1254 RGBA output. Runtime copies are 256 × 256 RGBA PNGs, resized with `sips`.
- All 21 runtime sprites total 1,374,741 bytes (approximately 1.31 MiB), with each below 150 KB.
- True transparent alpha was checked, including transparent-pixel coverage. Outputs with painted checkerboards were rejected and regenerated before selection.
- The full collection was visually reviewed at 32, 64 and 128 pixels against the game's dark surface. Rare and Epic frames were also reviewed in the real item-detail component.

Keep the sprites free of rarity borders, badges and halos. The UI supplies those treatments so that alternate rarity rolls retain consistent artwork. For new items, reuse the shared lighting, material rendering and composition rules in the archived prompts and [game design system](GAME_DESIGN_SYSTEM.md).

## Import and verification

The importer uses the project's `DATABASE_URL`. It does not run the general database seed or overwrite existing templates, stats or player inventories. Conflicting names or sprite paths abort the transaction.

```sh
npm run db:seed:atlas -- --check
npm run db:seed:atlas -- --apply
npm run db:seed:atlas -- --verify
npm run test:atlas
```

`--check` is the default read-only preview. `--apply` creates missing templates and their stats. `--verify` checks the stored definitions against the pack. The import was run twice: the first created 21 records, and the second kept the same 21 records. Database verification passed.

Six focused automated tests cover the collection, sprite files, unscaled template stats, default and explicit rarity creation, exact level boundaries, and equipment validation. The live UI was checked at preview character levels 1 and 50 without modifying a player's inventory.

The production build passed in an isolated temporary copy, and a separate `tsc --noEmit` passed. The new catalog, importer, tests, admin collection view and equipment-validation helper pass ESLint. Existing lint issues in legacy UI files and the build's existing dynamic-route diagnostics remain outside this content pack.
