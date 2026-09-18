# Wayfarer Accessories

This pack adds six grounded early-game items:

| Item                  | Type     | Rarity   | Level | Base effects                            |
| --------------------- | -------- | -------- | ----: | --------------------------------------- |
| Ironroot Band         | Ring     | Common   |     1 | +1 Armor, +8 Health                     |
| Tinker's Brass Signet | Ring     | Uncommon |     3 | +3 Accuracy, +1 Luck                    |
| Pilgrim's Bronze Ankh | Amulet   | Common   |     2 | +5 Prayer Points, +2 Magic Resist       |
| Fordstone Talisman    | Amulet   | Uncommon |     4 | +4 Cold Resist, +6 Health               |
| Rowan Bead Necklace   | Necklace | Uncommon |     5 | +12 Mana, +0.25 Mana Regen              |
| Traveler's Backpack   | Backpack | Common   |     5 | +50 inventory slots, -5% Movement Speed |

The Traveler's Backpack uses absolute rarity overrides for both of its stats.
Its capacity and movement penalty therefore remain exactly `+50` and `-5%`
even if an owned instance changes rarity.

## Import

The importer is idempotent and never overwrites an existing item or player
inventory:

```sh
npm run db:seed:accessories -- --check
npm run db:seed:accessories -- --apply
npm run db:seed:accessories -- --verify
```

Run `npm run test:accessories` to validate definitions, stat behavior, and all
six runtime sprites.
