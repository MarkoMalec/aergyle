# Cooking, recipes and food effects

Cooking uses the existing timestamp-based vocational activity system. Each completed cooking tick consumes the configured ingredients, grants the configured `FOOD` item, and awards vocation XP.

## Player flow

1. The Cooking skill page shows the starter dish plus dishes whose recipe the character has learned.
2. A `RECIPE` item can be found, traded, or granted by future loot/NPC systems. No vocational resource produces recipe items.
3. The character consumes the recipe from inventory to permanently record it in `UserLearnedRecipe`.
4. The linked dish becomes visible. Starting it still enforces its Cooking level, location, ingredients, and cooking time on the server.
5. Consuming the cooked `FOOD` item starts its timed benefits. One meal can be active at a time; another dish replaces it.

The active dish, remaining time, and benefits are shown beside the active vocational timer in the game header. Expired effects are ignored by both the client and server.

## Admin controls

- `/admin/items`: create and edit `FISH`, `MEAT`, `VEGETABLE`, `RECIPE`, and `FOOD` templates. Food templates expose a duration and a structured list of stat benefits.
- `/admin/vocations`: create and edit Cooking outputs, required recipe, Cooking level, seconds per unit, XP, yield, and per-unit ingredients. Cooking accepts only `FISH`, `MEAT`, and `VEGETABLE` requirements.
- `/admin/gardening`: adjust seed growth time, harvest time, output crop, yield range, and Gardening XP.
- `/admin/gathering`: configure wild ingredient pools on existing world locations that can feed future Cooking recipes.
- `/admin/locations`: enable or disable Cooking dishes per location. The initial seven dishes are enabled everywhere.

Setting a Cooking resource's required recipe to “None” makes it a starter dish. Assigning a `RECIPE` template hides it from characters who have not consumed that recipe.

## Data model

- `VocationalResource.requiredRecipeItemId`: optional recipe gate for a cooked dish.
- `VocationalRequirement`: exact ingredient template and quantity consumed per completed dish.
- `UserLearnedRecipe`: permanent per-character cooking recipe unlock.
- `Item.foodEffectSeconds`: meal duration.
- `FoodEffectStat`: editable stat/value rows for a food template.
- `UserActiveFoodEffect`: the character's current meal and expiry timestamp.

The legacy `INGREDIENT` item type is migrated to `VEGETABLE`; new cooking inputs use the concrete `FISH`, `MEAT`, or `VEGETABLE` types.

## Initial content

The idempotent content script validates or writes the Cooking skill, seven new ingredients, six plantable seed types, five recipe items, seven dishes, recipe links, benefits, ingredient requirements, and all current location assignments. Pan-fried Perch and Charred Silver Minnow are the two recipe-free starter dishes.

```bash
npm run db:seed:cooking -- --check
npm run db:seed:cooking -- --apply
npm run db:seed:cooking -- --verify
```

Content definitions live in `prisma/content/cooking.ts`; runtime sprites live below `public/assets/items`, with source masters and generation notes in `art/items/cooking-v1` and `art/items/cooking-v2`.
