# Carpentry v1 - plank prompt set

Generator: built-in `image_gen`. The selected master was made in two passes:
the base generation followed by a proportion-only edit so the object reads as
a plank rather than a timber beam.

## Pass 1 - base generation

```text
Use case: stylized-concept
Asset type: Aergyle inventory carpentry resource sprite

Create one inventory item sprite for Aergyle, in the “Wayfarer's Atlas” art direction.
A tangible carpentry material made by sawing a common log into a plank, illustrated with decisive faceted paint: believable construction, simplified chunky mass, crisp silhouette, three dominant value families, five to seven broad material planes, and two or three identifying texture marks. Medium stylisation; a crafted atlas illustration, not a photograph or 3D product render.

1024 by 1024 square RGBA canvas with a genuinely transparent background. Exactly one isolated wooden plank, optically centred, longest visible dimension 76-84 percent of the canvas, with 8-12 percent clear margins. The plank is a single long, thick, rectangular rough-sawn board with squared cut ends and subtly uneven hand-worked edges. No second plank, no stack, no bundle, no log, no bark shell, no nails, no rope, no tools, no floor, no cast-shadow stage, no border, no label, no text, no sawdust, and no vignette.

Orthographic-like three-quarter view, camera approximately 20 degrees above and 25-30 degrees around the object. The near squared end faces the lower-left/front and the plank's long axis recedes toward the upper-right, matching the visual orientation of Aergyle log and ingot resource sprites. Make the broad top face clearly dominant so it reads immediately as a milled plank, not a timber beam.

Subject and materials: Basic Plank made from an ordinary common log. Warm natural honey-tan wood, with a lighter broad top face, medium warm-brown near end grain, and cool desaturated brown-grey side shadow. Show three restrained lengthwise grain bands on the top, one small dark knot slightly off-centre, one short shallow drying split at the near end, and a few broad rough-sawn facets along the edges. The near end has subtle simplified end-grain arcs, but no bark. Solid, practical, untreated timber; neutral enough to serve as the base reference for future species variants such as emberwood, frostpine, willow, ash, and elderwood.

One warm-neutral light from upper-left at 10 o'clock and 45 degrees elevation. Cool desaturated teal-grey self-shadows; no second coloured rim light. Three clear value groups. Short broken highlights on useful upper edges under 8 percent of the object. Local dark edge only where needed; no thick uniform black outline. Restrained natural wood colour. Readable as a plank at 32px, wood material at 64px, knot and grain at 128px.

Constraints: no photorealism, anime, pixel art, plastic gradients, glossy varnish, elaborate carving, painted markings, bark plates, foliage, fantasy glow, molten seams, fire, frost, snow, moss, heavy cartoon outlines, ambient halo, bloom, particles, rarity effects, floating shadow, checkerboard, watermark, lettering, or UI.
```

## Pass 2 - selected proportion edit

Input image: Pass 1 output.

```text
Edit the provided Aergyle “Wayfarer's Atlas” Basic Plank inventory sprite.

Change only the board proportions so the object reads unmistakably as a sawn plank rather than a square timber beam: reduce its thickness substantially to about 14-18 percent of its visible width. The near lower-left end face must become a shallow, thin rectangular cross-section. Keep the plank broad, long, solid, and practical-not paper-thin.

Preserve the exact same single-object composition and orientation, transparent 1024x1024 RGBA canvas, optical centering, clear margins, orthographic-like three-quarter camera, lower-left near end and upper-right receding length, warm honey-tan natural wood, lighter broad top, cool brown-grey side shadow, three restrained lengthwise grain bands, one small off-centre knot, one short drying split at the near end, simplified end-grain arcs, rough-sawn edge facets, warm upper-left light, faceted painterly style, crisp silhouette, and three value groups.

Keep exactly one isolated plank. Do not add another plank, stack, bundle, log, bark, nails, rope, tools, floor, cast shadow, text, label, border, particles, checkerboard, or UI. No photorealism, glossy varnish, glow, magic effects, heavy black outline, or watermark.
```

## Future species-variant edit template

Use `basic-plank-master.png` as the edit target. Replace the bracketed material
paragraph and leave every invariant unchanged.

```text
Edit the provided Basic Plank master into a [SPECIES] Plank.

Change only the wood material, palette, grain, and two or three identifying
species marks: [SPECIES MATERIAL DESCRIPTION].

Preserve exactly the same single plank, proportions, camera, pose, silhouette,
framing, transparent canvas, edge shape, knot placement, near-end split,
faceted painterly rendering, upper-left lighting, and three value groups. Do
not add or remove objects. No environment, cast shadow, text, border, UI,
particles, glow, rarity treatment, or watermark.
```

## Selected species variants

Each selected species master used `basic-plank-master.png` as Image 1 (the edit
target) and its matching log artwork as Image 2 (material reference only). The
shared edit prompt preserved the exact plank geometry, 14-18 percent
thickness-to-width proportion, camera, lower-left near end, upper-right
receding length, broad top face, silhouette, transparent canvas, rough-sawn
edges, knot placement, short near-end split, faceted Atlas rendering,
upper-left lighting, cool self-shadows, and three value groups. It explicitly
excluded bark, additional objects, environment, cast shadow, text, UI,
particles, glow, rarity effects, photorealism, varnish, heavy outlines, and
watermarks.

The exact species material paragraphs were:

- **Oak Plank:** Sturdy warm golden-amber oak heartwood with bold open
  cathedral-shaped brown grain on the broad top face, a small dark umber knot,
  one restrained pale medullary-ray streak, warm golden-brown end grain, and a
  deep neutral brown side plane. Dense, durable, familiar hardwood. Keep the
  palette natural and less pale/yellow than pine.
- **Birch Plank:** Smooth pale warm-ivory birch heartwood with fine restrained
  golden-tan lengthwise grain, a small cinnamon-brown knot, two sparse
  dark-brown dash-like mineral flecks contained inside the top face, creamy end
  grain, and a cool taupe side plane. Fine, even, clean-working wood. Do not put
  white birch bark on the milled plank. Keep it warmer than willow and less
  yellow/resinous than pine.
- **Pine Plank:** Pale straw-ochre pine heartwood with three broad straight
  honey-gold grain ribbons, a small amber-brown resin knot, one restrained
  broken resin-gold streak that reflects light but does not glow, and warm
  reddish-tan end grain. Light, straight, practical beginner timber.
- **Willow Plank:** Cool pale cream willow wood with soft muted olive-grey and
  warm-tan lengthwise grain, a small shallow tan knot, gentle curved grain
  around it, and a cool grey-brown side plane. Supple, light, clean timber; all
  bark has been removed.
- **Ash Plank:** Warm honey-ochre ash wood with strong straight grey-brown
  lengthwise grain, dense even end-grain bands, one pale worn streak, and a firm
  medium-brown side plane. Robust practical hardwood with a slightly stronger,
  straighter grain contrast than pine.
- **Frostpine Plank:** Pale ivory-grey frostpine heartwood with three
  desaturated blue-grey lengthwise grain ribbons, a small dark blue-charcoal
  knot, cool slate-grey side and end planes, and two naturally whitened dry
  edge marks. Cold, dry timber; no snow, ice coating, particles, or glow.
- **Elderwood Plank:** Deep muted sienna and aged umber elderwood with dense
  close-set lengthwise grain, one broad dark-brown heartwood ribbon, a dark
  off-centre knot, and a subtle old crescent-shaped grain scar. Heavy ancient
  timber with warm brown end grain and charcoal-umber side shadow; natural and
  nonmagical.
- **Emberwood Plank:** Dark copper-red emberwood heartwood with broad
  burnt-sienna grain ribbons, near-black charcoal-brown side and end planes,
  one dull ochre central knot, and two restrained rust-red inner grain edges
  confined inside the wood. It catches warm light but never glows, burns,
  smokes, or emits embers.

Oak and Birch used their legacy log images only for species identity. Their
prompts additionally required ignoring the legacy background, lighting,
outline, framing, composition, bark, and (for Birch) moss.
