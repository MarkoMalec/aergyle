# Cross-Vocation Armor Sets

This content pack adds four complete, eight-slot armor sets. Every armor piece
has its own physical BLUEPRINT item, which is consumed as a normal recipe
requirement rather than learned permanently.

| Set                    | Final craft   | Character / craft level | Identity                                                                  |
| ---------------------- | ------------- | ----------------------- | ------------------------------------------------------------------------- |
| Mossweave Wayfarer     | Tailoring     | 18 / 20                 | Light cloth-and-leather field gear with Gathering and movement bonuses    |
| Ironbark Bulwark       | Carpentry     | 38 / 38                 | Oak lamellar armor with carrying capacity, health and Woodcutting bonuses |
| Frostsilver Tidewarden | Blacksmithing | 65 / 65                 | Cold-resistant plate with Fishing, Mining and magic-resistance bonuses    |
| Cinderweave Sentinel   | Tailoring     | 105 / 105               | Fireproof linked cloth with Fire Resistance and Hunting bonuses           |

Each set includes: head, chest, pauldrons, bracers, gloves, greaves, boots and
belt. The four sets total 32 armor crafts and 32 matching blueprint items.

## Production chains

The set recipes intentionally make vocational work interdependent.

| Set                    | Upstream work                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mossweave Wayfarer     | Gathering herbs become **Verdant Dye** through Alchemy. Cloth Scraps, Spider Silk and hunted Animal Sinew become a **Mossweave Bolt** through Tailoring.                                                                                                 |
| Ironbark Bulwark       | Woodcut Oak Planks, smelt Iron Ingots, Tailor Hardened Leather and gather Tempering Resin; Carpentry turns them into **Ironbark Lamella** before it makes the armor.                                                                                     |
| Frostsilver Tidewarden | Fish Frostscale Char, hunt Thick Fur and gather herbs for Alchemy's **Winter Tannin**; Tailoring creates **Frostscale Leather**. Mining supplies Frostsilver, and Weaponsmithing draws it into **Frostsilver Wire** for the final Blacksmithing recipes. |
| Cinderweave Sentinel   | Gather **Cinder Fiber** at Mount Doom, grow **Emberbloom** in the garden, turn Emberwood Logs into charcoal, distill **Cinder Dye**, forge **Doomsteel Links**, then Tailor the linked **Cindercloth Bolt** that makes the final set.                    |

This uses mining, woodcutting, fishing, hunting, gathering, gardening, alchemy,
carpentry, tailoring, blacksmithing and weaponsmithing where each material has
a clear physical role. Cooking is deliberately not part of armor construction.

## Seeding

Run the prerequisite content seeders first, then apply this pack:

```bash
npm run db:seed:vocations -- --apply
npm run db:seed:gathering -- --apply
npm run db:seed:hunting -- --apply
npm run db:seed:tailoring -- --apply
npm run db:seed:carpentry -- --apply
npm run db:seed:components -- --apply
npm run db:seed:dungeons -- --apply
npm run db:seed:armor-sets -- --apply
```

Use --check for a dry run and --verify to confirm the live catalog matches the
authored data. The armor-set seeder only changes its own item templates,
recipes, Mount Doom's Cinder Fiber gathering pool, and the required
crafting-skill records.

Definitions live in prisma/content/armorSets.ts; sprites are in
public/assets/items/armor and public/assets/items/resources.
