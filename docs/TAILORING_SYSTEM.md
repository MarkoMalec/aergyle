# Tailoring and craftable equipment

Tailoring is the first equipment-crafting profession. It deliberately reuses
the server-authoritative vocational activity engine: time, skill XP, inventory
requirements, location availability and output grants all follow the same path
as Cooking and Blacksmithing.

## Craftability and acquisition

Craftability is represented by a `VocationalResource` whose `actionType` is the
crafting profession and whose `itemId` points to the output item. There is no
exclusive `isCraftable` or `dropOnly` flag on `Item`.

This keeps acquisition modes composable:

- craft-only: give the item a crafting resource and omit it from drop tables;
- drop-only: include it in a drop table and omit a crafting resource;
- both: configure both independently.

`VocationalResource.itemId` is unique, so one item template has one canonical
production recipe and profession. `VocationalRequirement` rows define the exact
materials consumed for each completed unit. The item-type rules for crafting
professions live in `src/game/crafting.ts`; future professions add one rule
without changing the shared production engine.

## Blueprints

Blueprints use the distinct `ItemType.BLUEPRINT` category. They are physical
crafting inputs, not learnable recipes: a blueprint appears in the same
`VocationalRequirement` collection as cloth or hide and one copy is required
and consumed for each completed item. The normal server transaction checks and
consumes every configured requirement together.

Cooking keeps its separate `ItemType.RECIPE` and `UserLearnedRecipe` behavior.
This distinction lets a future profession use physical blueprints, permanent
recipes, ordinary materials, or any deliberate combination without treating
those concepts as interchangeable.

## Initial content

The Fieldweave set contains four independently equipped gathering pieces:

- Fieldweave Gloves: gloves; Armor, Gathering Efficiency and Luck;
- Fieldweave Trailboots: boots; Armor, Gathering Efficiency and Movement Speed;
- Fieldweave Leggings: legs; Armor, Gathering Efficiency and Luck;
- Fieldweave Tunic: chest; Armor, Gathering Efficiency and Luck.

Every piece requires its own physical blueprint. Cloth Scraps, Soft Hide and Spider
Silk are stackable materials added to existing location-based Gathering pools.
The equipment remains craft-only because it is not added to any drop or
gathering pool. Blueprints are intentionally loot/trade goods and are not
themselves craftable.

Crafted non-stackable items use the same rarity-aware instance-stat resolver as
other item grants, so the equipped `UserItem` carries the gathering bonuses and
the Gathering expedition snapshot consumes them normally.

## Skill categories

`skills.category` is either `VOCATION` or `CRAFTING`. The player sidebar renders
these as separate visual groups. This metadata is editable in the skill admin
screen so future skills do not require menu
code changes.

Crafting skill pages use a compact pattern catalog instead of the vocation
resource list. A sprite-led category menu is derived from output item types
(gloves, boots, swords, maces, and so on), with a name search and responsive
card grid. The catalog opens on one category rather than rendering every craft
at once, while an explicit "All" option remains available. This keeps large
future catalogs navigable without profession-specific page code or explanatory
UI copy.

## Content workflow

```bash
npm run db:migrate
npm run db:seed:tailoring -- --check
npm run db:seed:tailoring -- --apply
npm run db:seed:tailoring -- --verify
npm run test:tailoring
```

Definitions live in `prisma/content/tailoring.ts`. Runtime art lives under
`public/assets/items`; full-size source masters and generation notes live in
`art/items/tailoring-v1`.
