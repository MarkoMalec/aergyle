# Gardening slot artwork v1

Generated with the built-in OpenAI ImageGen workflow on 18 October 2026. These
PNGs are untouched source masters; the runtime versions below are the files
served by the Gardening screen.

## Runtime mapping

- `garden-grid-backdrop-master.png` →
  `public/assets/garden/garden-grid-backdrop-v1.webp` (1024×1024, WebP)
- `garden-plot-empty-master.png` →
  `public/assets/garden/plots/garden-plot-empty-v1.png` (512×512, transparent PNG)
- `garden-plot-cultivated-master.png` →
  `public/assets/garden/plots/garden-plot-cultivated-v1.png` (512×512, transparent PNG)

The backdrop is a six-by-six kitchen garden viewed from overhead. It supplies
the shared paths, stone edging and environmental texture behind the interactive
grid. The two transparent plot overlays deliberately have feathered, organic
edges and no UI-card frame: the empty variant depicts raked soil; the
cultivated variant reserves its centre for the existing crop item sprite.

## Generation direction

All three assets use grounded, hand-painted fantasy RPG art with post-rain
overcast light, damp umber soil, muted moss and sage greens, and restrained
weathered-stone detail. They exclude people, text, icons, UI borders and
watermarks. The cultivated overlay also excludes recognisable produce so it
remains compatible with every crop.
