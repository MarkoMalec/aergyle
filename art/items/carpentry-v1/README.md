# Carpentry v1 asset masters

Generated with the built-in OpenAI ImageGen tool on 2026-09-16 in the
Wayfarer's Atlas item direction.

## Master to runtime mapping

- `basic-plank-master.png` ->
  `public/assets/items/resources/planks/basic-plank-carpentry-v1.png`
- `oak-plank-master.png` ->
  `public/assets/items/resources/planks/oak-plank-carpentry-v1.png`
- `birch-plank-master.png` ->
  `public/assets/items/resources/planks/birch-plank-carpentry-v1.png`
- `pine-plank-master.png` ->
  `public/assets/items/resources/planks/pine-plank-carpentry-v1.png`
- `willow-plank-master.png` ->
  `public/assets/items/resources/planks/willow-plank-carpentry-v1.png`
- `ash-plank-master.png` ->
  `public/assets/items/resources/planks/ash-plank-carpentry-v1.png`
- `frostpine-plank-master.png` ->
  `public/assets/items/resources/planks/frostpine-plank-carpentry-v1.png`
- `elderwood-plank-master.png` ->
  `public/assets/items/resources/planks/elderwood-plank-carpentry-v1.png`
- `emberwood-plank-master.png` ->
  `public/assets/items/resources/planks/emberwood-plank-carpentry-v1.png`

The masters are untouched 1254 x 1254 RGBA outputs. Runtime copies are
256 x 256 RGBA PNGs with a 210 px occupied long dimension, Lanczos resampling,
and centered transparent padding. `basic-plank-master.png` remains an art
reference and is not a catalog item; the eight species planks are runtime
items and Carpentry recipes.

`basic-plank-master.png` is the canonical shape, camera, lighting, and material
reference for future plank variants. Derive variants by changing only the wood
species' palette and identifying marks; preserve the plank proportions,
orientation, silhouette, framing, and lighting.

The exact two-pass base prompt, selected species material prompts, and the
reusable species-variant edit template are in
[`PROMPTS.md`](PROMPTS.md).
