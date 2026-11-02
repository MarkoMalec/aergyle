# Reusable Handles and Materials

This content pack adds fourteen ordinary, stackable item templates. None is bound
to one consumer: recipes refer to the same global item IDs that trading,
inventory, loot, quests, and future crafting systems can reuse.

## Items and initial sources

| Item             | Type     | Initial source                                               |
| ---------------- | -------- | ------------------------------------------------------------ |
| Wooden Handle    | MATERIAL | Carpentry: 1 Oak Plank                                       |
| Duskbound Handle | MATERIAL | Carpentry: 1 Elderwood Plank, 1 Dusk Oil, 1 Hardened Leather |
| Birch Handle     | MATERIAL | Carpentry: 1 Birch Plank                                     |
| Pine Handle      | MATERIAL | Carpentry: 1 Pine Plank                                      |
| Willow Handle    | MATERIAL | Carpentry: 1 Willow Plank                                    |
| Ash Handle       | MATERIAL | Carpentry: 1 Ash Plank                                       |
| Frostpine Handle | MATERIAL | Carpentry: 1 Frostpine Plank                                 |
| Gloamwood Handle | MATERIAL | Carpentry: 1 Gloamwood Plank                                 |
| Emberwood Handle | MATERIAL | Carpentry: 1 Emberwood Plank                                 |
| Ironbark Handle  | MATERIAL | Carpentry: 1 Ironbark Plank                                  |
| Saltcedar Handle | MATERIAL | Carpentry: 1 Saltcedar Plank                                 |
| Dusk Oil         | MATERIAL | 12% Goblin drop (Gloamvault dungeon, Crownhold)              |
| Tempering Resin  | MATERIAL | Gathering at Goblins Camp and Ruins of Caldrath              |
| Hardened Leather | HIDE     | Tailoring: 2 Soft Hide, 1 Tempering Resin                    |

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

The importer is idempotent. It creates or updates the fourteen item templates,
configures twelve crafting recipes and the Tempering Resin gathering source.
