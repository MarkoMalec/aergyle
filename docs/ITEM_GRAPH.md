# Item graph

`/admin/item-graph` shows the item economy one item at a time: where an item
comes from, what it takes to make, and what it eventually leads to. It also
edits recipes in place and runs structural checks over every item. Each admin
item page (`/admin/items/[id]`) has a compact "Crafting chain" panel of the
same graph.

Nothing here is stored: the graph is derived from existing tables on every
page load, so it never goes stale and needs no migration.

## Model

Links run from an input to the item it helps produce:

| Link | Table | Meaning |
| --- | --- | --- |
| Ingredient (`×qty`) | `VocationalRequirement` | Consumed per recipe unit, by the resource's skill |
| Learn (dashed) | `VocationalResource.requiredRecipeItemId` | RECIPE item learned once |
| Seed (dotted) | `Item.seedYieldItemId` | Planting the seed grows the item |

Sources, i.e. how an item enters the game:

- **Crafted**: a `VocationalResource` of a crafting skill.
- **Gathered**: a Woodcutting, Mining, Fishing or Gathering resource.
- **Grown**: a seed that yields the item.
- **Dropped**: `CreatureDrop`.
- **Sold**: `NpcOffer`.
- **Quest reward**: `QuestRewardItem`.

Quest deliveries and community project requirements count as uses. The
marketplace and admin grants are not sources. A source is available only when
the game would pay it out:

- a resource needs an enabled location (a gathering-enabled one with a chance
  above zero, for Gathering);
- a drop needs an enabled creature that appears in an enabled hunting ground
  or dungeon;
- an offer, quest or project needs its NPC and settlement enabled, and a rare
  find only counts until its window closes.

Derived per item (`ItemFacts`):

- **Tier**: 0 unless crafted, otherwise one more than the deepest ingredient.
- **Role**:
  - Raw: obtained without crafting.
  - Intermediate: crafted, and used by another recipe.
  - Finished: used by no recipe.
- **Reach**: the distinct items it eventually leads to.
- **Upstream**: the distinct items it needs somewhere down its chains.
- **Obtainable**: some source can be completed with obtainable inputs
  (computed to a fixpoint).
- **Category**: grouped from `ItemType`.

## Views

- **Graph**: the focus lens.
  - What the item needs spreads to the left and what uses it to the right, so
    materials flow left to right.
  - A node's column is its longest path to the focus. A shared ingredient
    therefore appears once, left of all its uses, and every link points right.
    Red links running backwards are circular dependencies.
  - Progressive disclosure:
    - the Needs and Leads to depth controls;
    - the `+N` handle on a node, which opens one more level of that branch;
    - `−` on hover, which closes a branch;
    - a per-branch cap (8 by default), past which a node shows "+N more".
  - Clicking a node selects it, highlights everything upstream and downstream
    of it, and opens it in the inspector. Double-clicking re-focuses on it.
  - Trackpad scrolling pans; pinching, ⌘ + scroll or the mouse wheel zooms.
    `F` fits the graph to the screen.
  - The focus, view and depths live in the URL, so Back and shared links
    work. Breadcrumbs track the recent focuses.
- **Bill of materials**: the same item as an indented, collapsible tree for N
  crafts. It shows:
  - the raw materials, with shared intermediates crafted once for all
    branches;
  - crafts, base time, XP and the highest level needed, per skill;
  - the recipes to learn.
- **Catalog**: every item with its source icons, reach, upstream, tier and
  uses. It is sorted by reach, so the dependency hubs come first.
- **Issues**: the diagnostics below, grouped by kind, with adjustable
  thresholds.
- **Filters**: skill, how it's obtained, category, role and tier. They either
  dim the items that don't match or hide them. Hide stops the graph at those
  items.

## Editing

The inspector edits in place through the existing Vocation resources API, so
the skill item rules (`getResourceSkillConflict`) apply exactly as on
`/admin/vocations`:

- **Edit recipe / Add recipe**: skill, level, seconds, yield, XP, rarity,
  recipe to learn, and ingredients with quantities. It warns before saving a
  recipe whose ingredient is made from the item itself.
- **New item as ingredient**: quick-creates an item through
  `POST /api/admin/items`.
- **Insert a step**: ingredient → step → product. The step is a new or an
  existing item, which gets a recipe from the ingredient and optionally the
  product's locations. The product's recipe then uses the step instead of the
  ingredient.
- **Use in recipe**: adds the item as an ingredient of another recipe.
- **Locations**: the resource location editor, in a dialog.

Every source links out to its own editor (resource, hunting, dungeons, NPC,
settlement, item).

## Diagnostics

These are findings, not rules: each one can be a deliberate choice.

| Check | Severity |
| --- | --- |
| Circular dependency, including an item that needs itself | error |
| Recipe using a missing item | error |
| No source (error if something needs the item, otherwise a warning) | error / warning |
| Unobtainable: sources exist but none can be completed, with the reason | error |
| Recipe enabled at no location, while the item is obtainable another way | warning |
| Breaks its skill's item rules, or its learned recipe isn't a RECIPE item | warning |
| Dead-end intermediate: a crafted material nothing uses | warning |
| Level inversion: an ingredient needs a higher level in the same skill | warning |
| Identical ingredient sets | warning |
| Unused raw material | info |
| Similar ingredient sets (same skill, Jaccard overlap at or above the threshold) | info |
| Deeper than the tier limit | info |
| Bottleneck: reach at or above the threshold with a single available source | info |

## Code

- `src/game/itemGraph/`: pure, with tests in `tests/item-graph.test.ts`.
  - `graph.ts`: indexes, sources and facts. Cycles use Tarjan SCC; reach and
    upstream use bitsets over the component DAG.
  - `lens.ts`: the focus subgraph and its layout (longest-path columns,
    barycenter ordering, input ports).
  - `bom.ts`, `diagnostics.ts`, `filters.ts`, `taxonomy.ts`.
- `src/server/itemGraph/content.ts`: loads everything in one round of queries.
- `src/components/admin/itemGraph/`: the explorer, canvas, inspector, views
  and dialogs.

Scale: a synthetic economy of 5,000 items and 13,000 links builds in about
50 ms and diagnoses in about 30 ms, and a lens builds in 2 ms. The screen only
ever renders the lens, so it stays the same size however big the economy
gets.

To add a new kind of source, load it in `content.ts`, push it into `sources`
in `buildItemGraph`, and add its kind to `taxonomy.ts` (icon in `parts.tsx`).
