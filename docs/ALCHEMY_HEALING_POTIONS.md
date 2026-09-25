# Alchemy healing potions

The healing line uses the `healingAmount` item field. A player drinks a potion
or elixir from inventory to restore current health immediately, up to their
live maximum health; it does not create a temporary health-stat effect.

Any food, potion or elixir can carry `healingAmount` (admin item form →
"Instant healing"), and its item card shows "Restores N health". An item that
also has a timed effect applies both when consumed.

| Craft                 |   Restores | Alchemy level | Ingredients per unit                                       |
| --------------------- | ---------: | ------------: | ---------------------------------------------------------- |
| Minor Healing Potion  |  30 health |             1 | 1 Water, 1 Yarrow                                          |
| Small Healing Potion  |  75 health |            10 | 1 Water, 2 Yarrow, 1 Aloe                                  |
| Medium Healing Potion | 150 health |            25 | 2 Water, 2 Aloe, 1 Ginseng, 1 Echinacea                    |
| Big Healing Potion    | 325 health |            50 | 2 Water, 2 Ginseng, 2 Echinacea, 1 Amrans                  |
| Trollblood Elixir     | 750 health |            80 | 3 Water, 1 Troll Blood, 2 Ginseng, 2 Amrans, 2 Arkasu Bark |

The six added herbs are Yarrow, Aloe, Ginseng, Echinacea, Amrans and Arkasu
Bark. The first four are familiar real-world/RPG-style herbs; Amrans and
Arkasu are fantasy herb names inspired by the [Aidedd herb list](https://www.aidedd.org/dnd-filters/herbs.php).
They are gathered in Greenveil Plains, Goblins Camp and Frostcrown Peaks, and
every added herb is used by at least one recipe.

Water is a common `MATERIAL`, required by all five crafts. The Alchemy seeder
adds it to each enabled NPC shop only when that shop has no active Water offer,
so custom Water offers remain untouched. Troll Blood is an EPIC `MATERIAL`
with a 12% drop chance from the level-65 Stoneback Troll in Trollbreaker
Cavern, keeping the final elixir intentionally difficult to produce.

## Applying to an existing world

Apply the schema migration first, then use the additive content seeders in this
order:

```sh
npx prisma migrate deploy
npm run db:seed:gathering -- --apply
npm run db:seed:alchemy -- --apply
npm run db:seed:dungeons -- --apply
```

`db:seed:alchemy` updates a legacy `Health Potion` row in place to `Minor
Healing Potion`, retaining relationships such as owned stacks while replacing
its item definition and artwork. Use `--verify` after applying to check the
item, recipes, NPC Water offers and their dependencies.
