# Gathering resource artwork

Mode: `create` (ImageGen), followed by a deterministic 256×256 RGBA runtime
resize. The generated masters are retained in this directory.

Shared generation prompt:

> Create one isolated RPG inventory resource sprite of **[RESOURCE]** for
> Aergyle's Wayfarer's Atlas. Use a polished hand-painted, lightly faceted
> fantasy style with a chunky readable silhouette, believable real-world plant
> or food anatomy, restrained natural color, warm upper-left light, and a subtle
> dark contact shadow. Center the single resource cluster with comfortable
> padding. Transparent background, no scenery, frame, pedestal, glow, particles,
> text, letters, numbers, watermark, or rarity effects. Match the existing
> Aergyle resource icons and remain legible at 48 pixels. Square composition.

`[RESOURCE]` was replaced with: Mushrooms, Blackberries, Cranberries, Chestnuts,
Wild Plums, Wild Apples, Mint, Chamomile, Thyme, Sage, Rosemary, and Lavender.

Runtime exports:

- Foraged foods: `public/assets/items/resources/forage/*-gathering-v1.png`
- Herbs: `public/assets/items/resources/herbs/*-gathering-v1.png`
