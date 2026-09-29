# Hunting animal artwork v2 prompt record

Generator: built-in image generation, with one prompt per master. Each prompt
used this shared specification followed by its subject brief.

```text
Use case: stylized-concept
Asset type: Aergyle Hunting bestiary creature sprite, master artwork
Scene/backdrop: genuinely transparent RGBA background, no ground or cast shadow.
Style/medium: Aergyle Wayfarer's Atlas creature illustration: decisive faceted painted planes, medium stylisation, believable anatomy—not photorealistic, not an animal photo, not a 3D product render, not a cartoon mascot.
Composition/framing: full creature only, optically centred; occupies 76–84% of a 1024×1024 canvas with clear margins; slight three-quarter view with a readable face.
Lighting/mood: one warm-neutral key from upper-left, cool desaturated teal-grey self-shadows.
Constraints: no environment, ground, cast shadow, particles, glow, armour, weapon, labels, text, border, watermark, checkerboard, vignette, or thick black outline.
```

| Master                        | Subject brief appended to the shared prompt                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `briarback-badger-master.png` | A low, powerful woodland badger in a three-quarter standing pose facing right; charcoal-brown coat, broad pale head stripe, bramble-tough shoulder fur, readable face, paws, and compact claws; wary, not cute.                        |
| `snowhorn-ram-master.png`     | A sure-footed alpine ram in a three-quarter standing pose facing right; stone-grey wool, strong cream spiral horns, compact hooves, pale frost-weathered muzzle, readable eyes, legs, and horns; alert and formidable, not cute.       |
| `ruin-viper-master.png`       | One thick ancient-stone-coloured viper coiled in an alert raised-head pose facing right; muted olive and sandstone scales in broad painted facets, dark crown chevron, readable eyes and fangs; anatomically credible and threatening. |
| `cinder-jackal-master.png`    | A lean volcanic-country jackal in a three-quarter standing pose facing right; soot-dark reddish-brown coat, tall ears, pale ash-grey throat, and narrow alert muzzle; readable paws, tail, and face.                                   |
| `mangrove-panther-master.png` | A large low-slung island panther in a three-quarter stalking pose facing right; deep blue-black coat with subtle muted tide-grey rosettes, powerful shoulders, long tail, and alert pale eyes; formidable, not magical.                |

Subject-specific exclusions: Snowhorn Ram excludes snow and mountains; Ruin
Viper excludes ruins; Cinder Jackal excludes flame, smoke, and lava; Mangrove
Panther excludes mangroves and water. The lack of an environment is intentional
so every asset layers cleanly in inventory and bestiary UI.
