# Weapon artwork v1

Generated with OpenAI's built-in image generation tool on 2026-09-17.
The 1254×1254 RGBA masters live in this directory. Runtime sprites are
deterministically resized to 256×256 RGBA PNGs under
`public/assets/items/weapons/`.

The four wooden sprites replace the old visual set. The PNG paths are:

- `/assets/items/weapons/wooden-sword.png`
- `/assets/items/weapons/wooden-dagger.png`
- `/assets/items/weapons/wooden-axe.png`
- `/assets/items/weapons/wooden-mace.png`

## Shared generation prompt

> Create one Aergyle fantasy MMO inventory weapon sprite on a genuine
> transparent square RGBA canvas. Use polished hand-painted fantasy RPG art,
> decisive lightly faceted brushwork, believable construction, simplified
> chunky mass, a crisp silhouette, restrained medieval-fantasy design, three
> clear value groups, and broad material planes. Present one complete isolated
> weapon centered, normally running from the lower-left grip to the upper-right
> working end at about 45 degrees, filling 76–84 percent of the canvas with even
> transparent margins and no cropping. Light it with a warm-neutral upper-left
> key and cool desaturated teal-grey self-shadows, using only short restrained
> edge highlights. It must read at 32px. All pixels outside the object must be
> transparent. No text, frame, floor, cast-shadow stage, glow, particles,
> active magic, hands, character, sheath, extra objects, watermark,
> checkerboard, black or white backdrop. Avoid photorealism, anime, pixel art,
> thick outlines, plastic gradients, chrome studio lighting, and tiny filigree.

The existing Wayfarer's Atlas weapons were supplied as style, rendering,
lighting, transparency, scale, and composition references only.

## Subject prompts and runtime paths

| Name | Subject prompt | Runtime sprite |
| --- | --- | --- |
| Wooden Sword | Broad leaf-shaped oak training blade with blunt edge, simple crossguard, leather grip, round wooden pommel, and a few practice nicks | `/assets/items/weapons/wooden-sword.png` |
| Wooden Dagger | Short double-edged oak leaf blade with blunt bevels, compact guard, leather grip, and small wooden pommel | `/assets/items/weapons/wooden-dagger.png` |
| Wooden Axe | Dark seasoned-oak wedge head with blunt edge, lighter ash handle, rawhide lashings, and leather grip; no metal | `/assets/items/weapons/wooden-axe.png` |
| Wooden Mace | Compact six-flanged oak club head, ash shaft, rawhide binding, leather grip, and rounded wooden pommel | `/assets/items/weapons/wooden-mace.png` |
| Bronze Spear | Leaf-shaped bronze head with central ridge, darkened socket, straight ash shaft, leather wrap, and bronze butt cap | `/assets/items/weapons/bronze-spear.png` |
| Iron Longsword | Broad blue-grey iron blade with shallow fuller, downturned guard, leather grip, and faceted wheel pommel | `/assets/items/weapons/iron-longsword.png` |
| Steel Warhammer | Compact square-faced steel hammer with rear armor-pick, ash handle, iron collar, leather grip, and steel end cap | `/assets/items/weapons/steel-warhammer.png` |
| Ashwood Shortbow | Compact recurved pale-ash bow with reinforced tips, leather handle, natural-fiber string, and brass nocks; no arrow | `/assets/items/weapons/ashwood-shortbow.png` |
| Silver Rapier | Slender silver blade, restrained swept knuckle guard, wine-red leather grip, and faceted silver pommel | `/assets/items/weapons/silver-rapier.png` |
| Cobalt Halberd | Blue-grey cobalt axe blade, top spike, rear hook, dark ash pole, steel langets, leather grip, and cobalt butt cap | `/assets/items/weapons/cobalt-halberd.png` |
| Obsidian Greatsword | Massive smoky-black volcanic-glass blade with controlled chipped bevels, iron guard, two-handed leather grip, and heavy pommel | `/assets/items/weapons/obsidian-greatsword.png` |
| Emberwood Staff | Dark reddish emberwood shaft, hammered-bronze crown holding one unlit coal-red mineral, iron ferrule, and leather hand wrap | `/assets/items/weapons/emberwood-staff.png` |

