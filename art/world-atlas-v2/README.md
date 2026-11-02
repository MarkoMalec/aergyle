# Aergyle world atlas v2

Four connected 3840 × 2560 PNG assets, retaining the original atlas's 3:2
proportions. Place them in a 2 × 2 grid with no padding, gap, or overlap:

| Top-left | Top-right |
| --- | --- |
| `world-atlas-v2-top-left-4k.png` | `world-atlas-v2-top-right-4k.png` |
| `world-atlas-v2-bottom-left-4k.png` | `world-atlas-v2-bottom-right-4k.png` |

The files are in [`public/assets/world/atlas-v2/`](../../public/assets/world/atlas-v2/).
The [placement manifest](../../public/assets/world/atlas-v2/manifest.json)
records their exact coordinates within the 7680 × 5120 world.

## Preview and masters

- [Assembled preview, 1920 × 1280](world-atlas-v2-preview.jpg)
- [Full export master, 7680 × 5120](world-atlas-v2-master-7680x5120.png)
- [Native composition, 3072 × 2048](world-atlas-v2-native.png)
- [Browser WebP, 3072 × 2048](../../public/assets/world/atlas-v2/world-atlas-v2.webp)
- [Pixel alignment and dimension validation](validation.json)
- [Exact generation prompts and references](PROMPTS.md)
- [Generation provenance](generation.json)

## Resolution disclosure

The built-in image generator returned 1536 × 1024 for each independent
quarter despite the higher-resolution request. The assembled native artwork
is 3072 × 2048; it was resampled once at 2.5× with Lanczos3 to 7680 × 5120,
then divided into four exact 3840 × 2560 crops. These are **upscaled 4K
long-edge exports**, not native 4K generations. They preserve the original
3:2 map rather than cropping it to 16:9 UHD. Upscaling does not create
additional native detail.

## Art and assembly

The original `world-map-v1.png` governed geography and major landmark layout.
The homepage quay, NPC, beast, animal, and equipment assets informed material
finish, lighting and color. A new continuous layout painting established the
shared appearance; each quadrant received its own detail pass. Five local
image-generation edits repaired the northern, southern, western, eastern and
central joins. Narrow feathered overlaps integrate those repairs into one
continuous native composition before the global resize and final cropping.

The untouched image-generator outputs are in `source/`; the reference crops
are in `guides/`. Art was generated using the built-in imagegen tool. Sharp
only performs crop preparation, repair assembly, resampling and file export.

No labels or pins are baked into the art. The game's saved `AtlasConfig`
artwork setting now uses `/assets/world/atlas-v2/world-atlas-v2.webp` on
`/map`. This native-resolution WebP assembles the four quarters into one
browser asset for the existing map canvas, retaining all location coordinates
and travel controls. The four 4K PNG exports remain available separately.
`activation.json` records the previous and current artwork paths; the artwork
can also be selected through `/admin/locations`.

## Reproduce the exports

From the repository root, with its existing `sharp` dependency installed:

```sh
node art/world-atlas-v2/assemble.mjs
node art/world-atlas-v2/verify.mjs
```

The verification checks dimensions, color space, opacity, grid placement,
and exact equality of every exported pixel to its rectangle in the shared
master. Art continuity also received visual review at whole-map and native
crop scales. The source art can therefore be re-exported without another
image-generation request.
