# Dungeon monster artwork v1

Generated with OpenAI's built-in image generation tool on 2026-09-17.
The 1254×1254 RGBA masters live in this directory. Runtime sprites are
deterministically resized to 256×256 RGBA PNGs under
`public/assets/creatures/monsters/common/` and
`public/assets/creatures/monsters/rare/`.

The D&D bestiary linked in the request was used only to inform the breadth of
enemy types and size tiers. Every creature here uses an original Aergyle name
and design.

## Shared generation prompt

> Create one original Aergyle dungeon bestiary monster sprite on a genuine
> transparent square RGBA canvas. Use polished hand-painted, lightly faceted,
> grounded medieval-fantasy game art; believable anatomy or material behavior;
> a chunky readable silhouette; restrained colors; broad value planes; and
> selective texture. Show one complete creature in a clear three-quarter,
> action-ready pose, centered with all limbs, heads, tails, wings, and equipment
> visible. Use warm upper-left light and cool lower-right shading. Permit only a
> very soft semi-transparent contact shadow immediately beneath grounded feet.
> All other pixels outside the creature must be transparent. No scenery, ground
> slab, frame, text, UI, prey, gore, blood, dismemberment, bloom, large magic
> effects, particles, watermark, checkerboard, black or white backdrop. Avoid
> cute mascots, anime, pixel art, glossy 3D toys, thick outlines, noisy
> microdetail, and copied franchise designs.

Common enemies occupy roughly 70–82 percent of the canvas and prioritize
clarity at 48px. Rare enemies occupy roughly 78–88 percent, use broader forms
and a slightly lower viewpoint, and should feel like large room anchors without
relying on rarity glows or particle effects.

## Common enemies

| Name | Subject prompt | Runtime sprite |
| --- | --- | --- |
| Tunnel Goblin | Wiry olive-green scavenger with patched leather, rag-wrapped feet, crude buckler, and chipped cleaver | `/assets/creatures/monsters/common/tunnel-goblin.png` |
| Rattlebone Skeleton | Lean skeleton with cracked ribs, burial-cloth scraps, tarnished cap, battered shield, and notched short sword | `/assets/creatures/monsters/common/rattlebone-skeleton.png` |
| Mire Ooze | Translucent swamp-green crawling mound with pebbles, two small bone fragments, thick pseudopods, and two dim amber motes | `/assets/creatures/monsters/common/mire-ooze.png` |
| Cavefang Spider | Dog-sized charcoal subterranean spider with dusty joint plates, enlarged fangs, and an original pale marking | `/assets/creatures/monsters/common/cavefang-spider.png` |
| Rotclaw Ghoul | Gaunt ashen humanoid undead with long claws, sunken eyes, sparse hair, and torn burial trousers; no exposed gore | `/assets/creatures/monsters/common/rotclaw-ghoul.png` |
| Ash Imp | Small soot-black winged fiend with ember eyes, horn nubs, batlike wings, clawed feet, and spade tail | `/assets/creatures/monsters/common/ash-imp.png` |
| Ruin Bat | Single wolf-sized slate-grey dungeon bat in a diving pose with enormous ragged-but-intact wings | `/assets/creatures/monsters/common/ruin-bat.png` |
| Rootling | Knee-high animated creature of knotted roots and damp bark with thorny crown, moss patches, and pale green eyes | `/assets/creatures/monsters/common/rootling.png` |
| Plague Rat | Oversized charcoal-brown rat with chipped incisors, red-brown eyes, aggressive posture, and broken-tag rope collar | `/assets/creatures/monsters/common/plague-rat.png` |
| Scalehide Troglodyte | Stocky slate-olive reptilian cave humanoid with blunt snout, spinal ridge, thick tail, hide loincloth, and stone club | `/assets/creatures/monsters/common/scalehide-troglodyte.png` |

## Rare room-anchor enemies

| Name | Subject prompt | Runtime sprite |
| --- | --- | --- |
| Ironhide Ogre | Towering grey-brown brute in scavenged iron plates and hides, carrying a huge square-headed stone maul | `/assets/creatures/monsters/rare/ironhide-ogre.png` |
| Stoneback Troll | Huge long-armed grey-green cave predator with natural slate plates along its spine and forearms | `/assets/creatures/monsters/rare/stoneback-troll.png` |
| Tomb Sentinel | Towering empty dark-iron plate armor with restrained teal visor light, kite shield, flanged mace, and torn tabard | `/assets/creatures/monsters/rare/tomb-sentinel.png` |
| Miremaw Hydra | Massive swamp reptile with exactly three serpentine heads, one crocodilian body, four legs, and a thick tail | `/assets/creatures/monsters/rare/miremaw-hydra.png` |
| Emberhorn Minotaur | Towering dark-umber bull humanoid with mineral-streaked horns, iron harness, leather kilt, and two-handed axe | `/assets/creatures/monsters/rare/emberhorn-minotaur.png` |
| Hollow Wyrm | Huge wingless subterranean dragon-like beast with four legs, horned head, charcoal-blue scales, pale belly, and crystal chips | `/assets/creatures/monsters/rare/hollow-wyrm.png` |

