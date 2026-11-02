# Crafted Weapons

This content pack makes the categorized weapon art in
`public/assets/items/weapons/<type>/` playable: 53 new weapon and shield
templates for character levels 1–72, each with a recipe in the profession
that would make it. Two weapons that already existed, the Buckler and the
Bearded Greataxe, also get recipes. Definitions live in
[`prisma/content/craftedWeapons.ts`](../prisma/content/craftedWeapons.ts);
the importer is [`scripts/seedCraftedWeapons.ts`](../scripts/seedCraftedWeapons.ts).

| Profession     | Makes                                                   | New recipes | Levels |
| -------------- | ------------------------------------------------------- | ----------: | -----: |
| Weaponsmithing | swords, axes, greataxes, daggers, maces, flails, spears |          33 |   1–72 |
| Carpentry      | bows, crossbows, staves, wands                          |          16 |   2–66 |
| Blacksmithing  | shields                                                 |           6 |   1–64 |

Weaponsmithing previously had a single recipe (Frostsilver Wire at 65), so
this ladder is now the skill's whole early progression: there is a recipe at
every two to four levels from 1 to 72.

Not part of the pack: the **Ogre Cleaver** stays a drop (Ogre, Blackjaw
Stockade), and the **Tin Sword** gets no recipe, because no tin ingot exists
for it.

## Design rules

**Crafted weapons are the dependable baseline.** Drops are meant to be better.

- **Stats are the gear budget for the weapon's level.** Every number comes from
  `budgetItemStats` in [`src/game/balance/budget.ts`](../src/game/balance/budget.ts),
  computed with the live growth and combat config, the same method
  `scripts/rebalanceGear.ts` used for existing gear. The existing Bearded
  Greataxe comes out identical (51–70, +18 critical damage), so the new weapons
  sit on the same curve as current gear.
- **Rarity keeps them modest.** Crafts produce Common copies up to level 38 and
  Uncommon from 42 (×1.0 and ×1.1). The budget is anchored on on-level Rare
  gear (×1.35), so a crafted weapon deals 74–81% of an on-level Rare drop. The
  strongest craft, the level 72 Steel Greataxe, hits for about 60% of the Ogre
  Cleaver.
- **The craft level is the equip level.** A level-30 weapon needs Weaponsmithing
  30, the same convention as the crafted armor sets.
- **Materials unlock before the recipes that need them.** Iron, copper, bronze,
  oak, birch, pine and willow, hide, bone, sinew and antler all come from the
  level-1 towns and hunting grounds. Steel Ingot (Blacksmithing 40), Ash Plank
  (Goblins Camp, 40), Hardened Leather and Tempering Resin (resin from Goblins
  Camp) appear only from level 42. Frostpine Plank and Curved Horn (Frostcrown
  Peaks, 50) appear only from level 58. The only exceptions are four level 1–3
  recipes that need copper or iron ingots, whose ore needs Mining 5. The
  game's existing level-1 ingot and pickaxe recipes have the same dependency.
- **Every recipe has its own ingredient set**, so `/admin/item-graph` reports
  no identical recipes. Each weapon family has a signature material: bone grips
  on daggers, sinew lashing on axes and spears, oak hafts on maces, copper or
  bronze chain on flails, willow hafts on greataxes, rawhide rims on shields.
- **XP follows the existing crafting rate**: about `1,000 + 13 × level` XP per
  hour, the rate the plank, ingot and armor recipes already pay. Craft time is
  `30 + 1.8 × level` seconds, ×1.3 for two-handed weapons and ×1.2 for shields.
- **Value is 1.2 × the materials' value**, a small return on crafting time
  without a new gold source. The iron tier is cheap because Iron Ingot is
  valued at 2 gold.

Two-handed: greataxes, staves and the Steel Bastard Sword. Bows and crossbows
are one-handed, like the existing Reedwind Bow. The budget gives two-handed
weapons ×1.3 damage for the off hand they give up. Two-handed bows would have
out-hit that Rare bow.

Secondary stat by type: swords Accuracy + Critical Chance, daggers Critical
Chance, axes and greataxes Critical Damage, maces Armor, flails Critical Chance +
Critical Damage, spears Melee Evasion, bows Accuracy + Critical Chance,
crossbows Critical Damage, staves Critical Chance, wands Critical Damage,
shields Health. Accuracy has no effect in combat yet (see
[FORMULA_REFERENCE.md](FORMULA_REFERENCE.md)).

## Skill rule change

The shipped item-type rules give no skill staves or wands. The seeder adds
`STAFF` and `WAND` to Carpentry's outputs on `/admin/vocations/rules` and leaves
every other entry as it is.

## The ladder

`*` already existed; only the recipe is new.

### Blacksmithing

| Lvl | Weapon             | Hands    | Rarity   | Base damage           | Speed | Secondary    | Materials                                                         | Seconds |  XP |
| --: | ------------------ | -------- | -------- | --------------------- | ----: | ------------ | ----------------------------------------------------------------- | ------: | --: |
|   1 | Buckler \*         | off hand | Common   | 6 armor, 10% block    |     – | 0.4–1 damage | 2 Oak Plank, 1 Iron Ingot                                         |      40 |  11 |
|   8 | Woodbound Shield   | off hand | Common   | 8 armor, 10.2% block  |     – | 9 health     | 4 Oak Plank, 2 Iron Ingot, 1 Copper Ingot                         |      55 |  17 |
|  18 | Round Shield       | off hand | Common   | 11 armor, 10.5% block |     – | 14 health    | 3 Willow Plank, 2 Iron Ingot, 1 Bronze Ingot, 1 Raw Hide          |      75 |  26 |
|  32 | Iron Heater Shield | off hand | Common   | 14 armor, 10.9% block |     – | 22 health    | 6 Iron Ingot, 2 Oak Plank, 2 Raw Hide                             |     105 |  41 |
|  46 | Kite Shield        | off hand | Uncommon | 18 armor, 11.4% block |     – | 29 health    | 3 Steel Ingot, 3 Ash Plank, 1 Hardened Leather, 1 Tempering Resin |     135 |  60 |
|  64 | Steel Shield       | off hand | Uncommon | 23 armor, 11.9% block |     – | 38 health    | 7 Steel Ingot, 2 Hardened Leather, 1 Tempering Resin              |     175 |  89 |

### Carpentry

| Lvl | Weapon              | Hands | Rarity   | Base damage   | Speed | Secondary                        | Materials                                                            | Seconds |  XP |
| --: | ------------------- | ----- | -------- | ------------- | ----: | -------------------------------- | -------------------------------------------------------------------- | ------: | --: |
|   2 | Reed Staff          | 2H    | Common   | 9–14 magic    |  0.85 | 4 critical chance                | 2 Pine Plank, 1 Copper Ingot                                         |      45 |  13 |
|   5 | Copper-Tipped Wand  | 1H    | Common   | 8–12 magic    |   1.2 | 12 critical damage               | 1 Oak Plank, 1 Copper Ingot                                          |      40 |  12 |
|   9 | Yew Shortbow        | 1H    | Common   | 14–21         |     1 | 3 accuracy, 2.3 critical chance  | 2 Pine Plank, 1 Animal Sinew                                         |      45 |  14 |
|  14 | Light Crossbow      | 1H    | Common   | 29–40         |   0.7 | 13 critical damage               | 2 Willow Plank, 2 Iron Ingot, 1 Animal Sinew                         |      55 |  18 |
|  18 | Rowan Wand          | 1H    | Common   | 20–30 magic   |   1.2 | 13 critical damage               | 2 Willow Plank, 1 Bronze Ingot                                       |      60 |  21 |
|  22 | Elm Recurve Bow     | 1H    | Common   | 28–42         |     1 | 5 accuracy, 2.5 critical chance  | 3 Willow Plank, 2 Animal Sinew, 1 Stag Antler                        |      70 |  25 |
|  24 | Ironwood Staff      | 2H    | Common   | 47–70 magic   |  0.85 | 4.4 critical chance              | 3 Willow Plank, 2 Iron Ingot                                         |      95 |  35 |
|  28 | Lever Crossbow      | 1H    | Common   | 53–72         |   0.7 | 14 critical damage               | 2 Willow Plank, 3 Iron Ingot, 1 Bronze Ingot, 1 Animal Sinew         |      80 |  30 |
|  32 | Ironbound Wand      | 1H    | Common   | 33–49 magic   |   1.2 | 14 critical damage               | 2 Pine Plank, 2 Iron Ingot                                           |      90 |  35 |
|  42 | Ash Longbow         | 1H    | Uncommon | 51–76         |     1 | 7 accuracy, 2.7 critical chance  | 3 Ash Plank, 2 Animal Sinew, 1 Hardened Leather                      |     105 |  45 |
|  44 | Ash Staff           | 2H    | Uncommon | 81–121 magic  |  0.85 | 4.8 critical chance              | 3 Ash Plank, 1 Hardened Leather                                      |     140 |  61 |
|  48 | Reinforced Crossbow | 1H    | Uncommon | 87–118        |   0.7 | 16 critical damage               | 2 Ash Plank, 3 Steel Ingot, 1 Bronze Ingot, 2 Animal Sinew           |     115 |  52 |
|  48 | Ash Wand            | 1H    | Uncommon | 48–72 magic   |   1.2 | 16 critical damage               | 2 Ash Plank, 1 Tempering Resin                                       |     115 |  52 |
|  58 | Hornwood Bow        | 1H    | Uncommon | 69–103        |     1 | 10 accuracy, 2.8 critical chance | 2 Frostpine Plank, 2 Curved Horn, 2 Animal Sinew, 1 Tempering Resin  |     135 |  66 |
|  62 | Steel-Capped Staff  | 2H    | Uncommon | 112–168 magic |  0.85 | 5.1 critical chance              | 3 Frostpine Plank, 2 Steel Ingot, 2 Tempering Resin                  |     185 |  93 |
|  66 | Steel Crossbow      | 1H    | Uncommon | 118–159       |   0.7 | 17 critical damage               | 2 Frostpine Plank, 6 Steel Ingot, 2 Animal Sinew, 1 Hardened Leather |     150 |  77 |

### Weaponsmithing

| Lvl | Weapon              | Hands | Rarity   | Base damage | Speed | Secondary                               | Materials                                                                | Seconds |  XP |
| --: | ------------------- | ----- | -------- | ----------- | ----: | --------------------------------------- | ------------------------------------------------------------------------ | ------: | --: |
|   1 | Boot Dagger         | 1H    | Common   | 3.2–5       |   1.4 | 3 critical chance                       | 1 Copper Ingot, 1 Wooden Handle                                          |      30 |   8 |
|   3 | Hand Axe            | 1H    | Common   | 7–13        |   0.9 | 12 critical damage                      | 2 Iron Ingot, 1 Birch Plank                                              |      35 |  10 |
|   5 | Cudgel Mace         | 1H    | Common   | 11–16       |  0.85 | 7 armor                                 | 2 Iron Ingot, 1 Wooden Handle, 1 Oak Plank                               |      40 |  12 |
|   6 | Copper Longsword    | 1H    | Common   | 10–16       |     1 | 2 accuracy, 2.3 critical chance         | 3 Copper Ingot, 1 Wooden Handle, 1 Raw Hide                              |      40 |  12 |
|   7 | Leaf Spear          | 1H    | Common   | 12–18       |  0.95 | 3.1 evasion melee                       | 2 Copper Ingot, 2 Pine Plank, 1 Raw Hide                                 |      45 |  14 |
|   8 | Ball Flail          | 1H    | Common   | 14–26       |   0.8 | 2.3 critical chance, 9 critical damage  | 3 Iron Ingot, 1 Copper Ingot, 1 Wooden Handle                            |      45 |  14 |
|  12 | Militia Sword       | 1H    | Common   | 16–27       |     1 | 3 accuracy, 2.4 critical chance         | 2 Bronze Ingot, 1 Wooden Handle, 1 Raw Hide                              |      50 |  16 |
|  14 | Chain Flail         | 1H    | Common   | 21–39       |   0.8 | 2.4 critical chance, 10 critical damage | 3 Iron Ingot, 1 Bronze Ingot, 1 Wooden Handle                            |      55 |  18 |
|  16 | Guard Dagger        | 1H    | Common   | 14–24       |   1.4 | 3.2 critical chance                     | 2 Bronze Ingot, 1 Small Bones, 1 Raw Hide                                |      60 |  20 |
|  18 | Boar Spear          | 1H    | Common   | 25–38       |  0.95 | 3.2 evasion melee                       | 2 Bronze Ingot, 2 Willow Plank, 1 Animal Sinew                           |      60 |  21 |
|  20 | Iron Hand Axe       | 1H    | Common   | 25–47       |   0.9 | 14 critical damage                      | 4 Iron Ingot, 1 Wooden Handle, 1 Animal Sinew                            |      65 |  23 |
|  20 | Bearded Greataxe \* | 2H    | Common   | 51–70       |   0.7 | 18 critical damage                      | 6 Iron Ingot, 2 Willow Plank, 1 Raw Hide                                 |      85 |  30 |
|  22 | Flanged Mace        | 1H    | Common   | 33–50       |  0.85 | 12 armor                                | 4 Iron Ingot, 1 Bronze Ingot, 1 Oak Plank                                |      70 |  25 |
|  24 | Guard Sword         | 1H    | Common   | 29–48       |     1 | 5 accuracy, 2.5 critical chance         | 4 Iron Ingot, 1 Bronze Ingot, 1 Wooden Handle, 1 Raw Hide                |      75 |  27 |
|  26 | Iron Flail          | 1H    | Common   | 36–67       |   0.8 | 2.5 critical chance, 10 critical damage | 5 Iron Ingot, 1 Wooden Handle, 1 Raw Hide                                |      75 |  28 |
|  28 | Iron Spear          | 1H    | Common   | 37–55       |  0.95 | 3.4 evasion melee                       | 4 Iron Ingot, 2 Pine Plank, 1 Animal Sinew                               |      80 |  30 |
|  30 | Iron Greataxe       | 2H    | Common   | 74–100      |   0.7 | 19 critical damage                      | 8 Iron Ingot, 2 Willow Plank, 1 Raw Hide, 1 Animal Sinew                 |     110 |  42 |
|  30 | Iron Dirk           | 1H    | Common   | 25–42       |   1.4 | 3.4 critical chance                     | 4 Iron Ingot, 1 Small Bones, 1 Raw Hide                                  |      85 |  33 |
|  32 | Bearded Axe         | 1H    | Common   | 38–71       |   0.9 | 14 critical damage                      | 5 Iron Ingot, 1 Wooden Handle, 1 Raw Hide, 1 Animal Sinew                |      90 |  35 |
|  34 | Iron Falchion       | 1H    | Common   | 39–65       |     1 | 6 accuracy, 2.6 critical chance         | 6 Iron Ingot, 1 Bronze Ingot, 2 Raw Hide                                 |      90 |  36 |
|  36 | Iron Mace           | 1H    | Common   | 52–78       |  0.85 | 16 armor                                | 7 Iron Ingot, 1 Oak Plank, 1 Animal Sinew                                |      95 |  39 |
|  38 | Spiked Flail        | 1H    | Common   | 51–94       |   0.8 | 2.6 critical chance, 11 critical damage | 7 Iron Ingot, 1 Oak Plank, 1 Raw Hide, 1 Animal Sinew                    |     100 |  42 |
|  42 | Ash Spear           | 1H    | Uncommon | 53–80       |  0.95 | 3.6 evasion melee                       | 2 Steel Ingot, 2 Ash Plank, 1 Animal Sinew                               |     105 |  45 |
|  44 | Splitting Greataxe  | 2H    | Uncommon | 105–141     |   0.7 | 20 critical damage                      | 5 Steel Ingot, 2 Ash Plank, 2 Raw Hide                                   |     140 |  61 |
|  46 | Steel Axe           | 1H    | Uncommon | 54–100      |   0.9 | 15 critical damage                      | 4 Steel Ingot, 1 Ash Plank, 1 Hardened Leather                           |     115 |  51 |
|  50 | Morning Flail       | 1H    | Uncommon | 65–121      |   0.8 | 2.7 critical chance, 12 critical damage | 4 Steel Ingot, 1 Ash Plank, 1 Hardened Leather, 1 Animal Sinew           |     120 |  55 |
|  52 | Winged Spear        | 1H    | Uncommon | 65–98       |  0.95 | 3.7 evasion melee                       | 4 Steel Ingot, 2 Ash Plank, 1 Animal Sinew, 1 Raw Hide                   |     125 |  58 |
|  54 | Steel Stiletto      | 1H    | Uncommon | 43–72       |   1.4 | 3.7 critical chance                     | 3 Steel Ingot, 1 Bronze Ingot, 1 Hardened Leather                        |     125 |  59 |
|  56 | Steel Mace          | 1H    | Uncommon | 78–117      |  0.85 | 21 armor                                | 6 Steel Ingot, 2 Iron Ingot, 1 Ash Plank, 1 Hardened Leather             |     130 |  62 |
|  60 | Steel Bastard Sword | 2H    | Uncommon | 102–169     |  0.85 | 13 accuracy, 3.8 critical chance        | 7 Steel Ingot, 1 Bronze Ingot, 2 Hardened Leather, 1 Tempering Resin     |     180 |  89 |
|  64 | Steel Flail         | 1H    | Uncommon | 82–153      |   0.8 | 2.9 critical chance, 13 critical damage | 7 Steel Ingot, 1 Frostpine Plank, 2 Hardened Leather                     |     145 |  74 |
|  68 | Steel Spear         | 1H    | Uncommon | 84–126      |  0.95 | 3.9 evasion melee                       | 5 Steel Ingot, 2 Frostpine Plank, 2 Animal Sinew, 1 Tempering Resin      |     150 |  79 |
|  72 | Steel Greataxe      | 2H    | Uncommon | 166–225     |   0.7 | 23 critical damage                      | 10 Steel Ingot, 2 Frostpine Plank, 2 Hardened Leather, 2 Tempering Resin |     205 | 110 |

Damage and stats are Common-equivalent template values. Uncommon copies get
×1.1.

## Tuning

Everything is admin data once imported: stats, level and value on
`/admin/items`, and recipe time, XP, level, materials and order on
`/admin/vocations`. Re-running `--apply` writes the pack's values back over
item and recipe edits (recipe order excepted), so change the pack too when a
tuned number should stick.

## Import and verification

The materials (ingots, planks, Wooden Handle, hunting drops, Hardened Leather,
Tempering Resin) and the Weaponsmithing, Carpentry and Blacksmithing skills
must already exist. They come from the vocation, carpentry, component, hunting
and armor-set packs.

```sh
npm run db:seed:weapons -- --check
npm run db:seed:weapons -- --apply
npm run db:seed:weapons -- --verify
npm test
```

`--check` is read-only. `--apply` creates or updates the 53 templates and their
stats, adds the 55 recipes at every location (new recipes go to the end of each
skill's list), and widens Carpentry's rule. `--verify` checks the stored state
against the pack. `tests/crafted-weapons.test.ts` checks the following:

- every categorized sprite is used once;
- stats match the budget;
- crafted weapons stay below on-level Rare drops and the Ogre Cleaver;
- each weapon is made by the right profession at its equip level;
- materials unlock in time;
- ingredient sets are distinct;
- XP rates follow the existing crafting rate.
