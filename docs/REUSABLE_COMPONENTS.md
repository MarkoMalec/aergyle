# Reusable Handles and Materials

This content pack adds five ordinary, stackable item templates. None is bound
to one consumer: recipes refer to the same global item IDs that trading,
inventory, loot, quests, and future crafting systems can reuse.

## Items and initial sources

| Item             | Type     | Initial source                                               |
| ---------------- | -------- | ------------------------------------------------------------ |
| Wooden Handle    | MATERIAL | Carpentry: 1 Oak Plank                                       |
| Duskbound Handle | MATERIAL | Carpentry: 1 Elderwood Plank, 1 Dusk Oil, 1 Hardened Leather |
| Dusk Oil         | MATERIAL | 12% Goblin drop (Gloamvault dungeon, Crownhold)              |
| Tempering Resin  | MATERIAL | Gathering at Goblins Camp and Ruins of Caldrath              |
| Hardened Leather | HIDE     | Tailoring: 2 Soft Hide, 1 Tempering Resin                    |

The Basic Pickaxe's Blacksmithing recipe now consumes 1 Iron Ingot and 1 Wooden
Handle. That recipe is only the first use of Wooden Handle; it does not confer
any exclusivity on the item.

## Dungeon loot

Dusk Oil is an ordinary `CreatureDrop` on the Goblin, seeded by
`npm run db:seed:dungeons` (see [Dungeons](DUNGEONS_SYSTEM.md)). Like any item,
it can be added to other creatures in the admin.

## Applying content

```sh
npm run db:seed:components -- --check
npm run db:seed:components -- --apply
npm run db:seed:components -- --verify
```

The importer is idempotent. It creates or updates the five item templates,
configures three crafting recipes and the Tempering Resin gathering source, and
replaces the Basic Pickaxe's legacy generic Plank requirement with Wooden
Handle while preserving the pickaxe recipe's other settings.
