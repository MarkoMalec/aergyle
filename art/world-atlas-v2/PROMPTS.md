# Aergyle world atlas v2 — exact generation prompts

Generated on 2026-10-31 using the built-in image generation tool, with local image references.
Native outputs were 1536 × 1024. The requested final 3840 × 2560 quarters are 2.5× exports, not native 4K renders.

## Full-world layout and style master

References, in order:
1. `public/assets/world/world-map-v1.png`
2. `public/assets/homepage/market-quay-v1.png`
3. `public/assets/npcs/osric-vale-angler-v1.png`
4. `public/assets/creatures/monsters/rare/stoneback-troll.png`
5. `public/assets/creatures/animals/red-deer-hunting-v1.png`

```text
Use case: style-transfer.
Asset type: Aergyle browser MMORPG world atlas, continuous master painting used as the composition and seam reference for four enlarged quarters.
Input images: Image 1 is the EDIT TARGET and absolute geography/layout authority (the existing world atlas). Image 2 is the game's market-quay environment STYLE reference. Images 3–5 are supporting NPC, beast and animal material/rendering STYLE references only; do not add these subjects to the map.
Primary request: Recreate the full existing atlas with a substantial improvement in material realism, terrain detail and polish, fully consistent with these game assets. Preserve the original world's recognizable composition and geography extremely faithfully. This is an enhancement of this exact map.
Composition/framing: 3:2 landscape, same elevated three-quarter atlas viewpoint, same camera and all landmass silhouettes, same shoreline shapes, rivers and channels, island positions, mountain and building footprints. Full world remains in frame. Every major landmark must remain in precisely its existing relative position: broad snowy mountain range at northwest; isolated smoking lava volcano in north-central ocean; lavender ruined plateau north of central castle; wooded northeastern camp peninsula; gold-roofed circular river citadel at x42%, y51%; pastoral southwest plains tapering into the sandy lagoon peninsula; small pirate island entering the southwest corner; southern river-city island chain near x64%, y76%; monumental black burning gothic fortress occupying the east. Preserve the smaller blue stone coastal outpost south of the dark fortress. Do not invent or remove continents or move the volcano. Keep all major waterways open and in their existing positions.
Style/medium: richly finished realistic fantasy game illustration with the weathered, tactile craft and warm natural light of the supporting Aergyle references. Fine hand-painted realism, physically credible rock strata, dense individual tree crowns, worn masonry, slate roofs, timber houses and dock planks. Clear fine detail rather than flat toy-like landforms. Earthy olive and forest greens, aged sandstone and antique gold, muted violet rock, cobalt/teal ocean, cold ivory snow, restrained glowing amber lava. Preserve the pleasant readable blues and greens of the original while adding the grounded atmosphere of the homepage artwork.
Detail: articulate snow cornices, cliff strata, scree slopes, mountain footpaths, pine trees, wooded copses, farm plots, hedges, winding dirt roads, small bridges and waterside hamlets within the existing shapes. Towns have believable little streets, courtyards, walls and quays. Water shows coherent currents, shoals, reefs and delicate shoreline foam. Slightly stronger local landmark/readable feature scale creates a subtly closer feeling, without shifting map coordinates or cropping the map. Keep the whole image crisp, with soft atmospheric depth only at the remote upper ocean; no depth-of-field blur.
Lighting: one coherent late-afternoon illumination from upper left, warm sunlight, cool detailed shadows, natural contrast. The east retains its local ember glow, not an unrelated night scene. Thin cloud wisps at the outer world edge, less obscuring terrain.
Output: one uninterrupted borderless full-world image, maximum-detail landscape render, target 3504 x 2336 pixels (3:2). No grid, no panels or internal frame, no text, lettering, map labels, pins, compass, UI, logos or watermark. Do not include any portrait, animal, weapon or photographic scene from the style references. Preserve all map geography.
```

## top-left

References, in order: `guides/top-left.png`, `source/world-layout-master.png`, `public/assets/homepage/market-quay-v1.png`, `public/assets/items/weapons/ogre-cleaver-atlas-v1.png`. The first two paths are relative to this directory; the others are relative to the repository.

```text
Use case: style-transfer.
Asset type: one high-detail quarter of the existing Aergyle MMORPG atlas, part of a seamless 2-by-2 world.
Input images: Image 1 is the exact cropped EDIT TARGET and strict spatial guide. Image 2 is the complete approved world-layout reference only; do NOT render the whole world. Image 3 is the existing game's market-quay environment STYLE reference. Image 4 is the game's weathered equipment material STYLE reference only.
Primary request: Redraw Image 1 alone with far more resolved local detail and the premium realistic fantasy rendering of the game assets. Keep the exact crop, terrain silhouettes, coordinates, coastline shapes, roads, river widths, building footprints and camera of Image 1. This is a zoomed detail restoration of that crop, not a new map. Structures cut by the crop boundary MUST remain cut at precisely the same points. Never recenter or fit a cut-off feature entirely into the picture.
Rendering: grounded hand-painted realism with crisp natural surfaces and fine material differentiation: rock strata, scree, weathered masonry, individual tree branches and crowns, little roof tiles and windows, hedges and pasture plots, distinct dirt tracks, tiny docks and bridges, coherent sea currents and fine foam. Preserve the existing warm upper-left sunlight and the exact brightness/palette: deep cobalt blue sea with teal shallows, earthy green vegetation, pale ivory snow, antique gold and aged stone. Sharply resolve the details without adding artificial texture grain, painterly smears, over-sharpening halos, depth-of-field blur or haze over the playable land.
Seam requirement: this is one crop from a single larger painting. Retain the precise content along ALL FOUR EDGES of Image 1, down to the coast intersections, tree placements, mountain and building silhouettes. Outer-edge lighting, colors and geometry must remain unchanged so neighboring crops can connect. Add detail within the already established forms, without repositioning anything.
Output: one borderless landscape image, exact 3:2 aspect ratio, request maximum native resolution / 4K detail. No text, labels, pins, typography, compass, UI, frame, panels, grid or watermark. Do not show equipment or standalone reference objects.
Quarter content: NORTHWEST QUARTER ONLY. Preserve the immense diagonal snow-and-granite mountain spine, dark pine passes, alpine lakes, pastoral foothills and hamlets; the northern ocean with the burning volcanic island at upper right; the golden central citadel clipped by the lower-right edge, with its towers and roofs cut exactly as in Image 1. Snow crevasses, individual pine crowns, craggy outcrops and lava channels need especially fine visible detail. Do not complete the cropped citadel.
```

## top-right

References, in order: `guides/top-right.png`, `source/world-layout-master.png`, `public/assets/homepage/market-quay-v1.png`, `public/assets/items/weapons/ogre-cleaver-atlas-v1.png`. The first two paths are relative to this directory; the others are relative to the repository.

```text
Use case: style-transfer.
Asset type: one high-detail quarter of the existing Aergyle MMORPG atlas, part of a seamless 2-by-2 world.
Input images: Image 1 is the exact cropped EDIT TARGET and strict spatial guide. Image 2 is the complete approved world-layout reference only; do NOT render the whole world. Image 3 is the existing game's market-quay environment STYLE reference. Image 4 is the game's weathered equipment material STYLE reference only.
Primary request: Redraw Image 1 alone with far more resolved local detail and the premium realistic fantasy rendering of the game assets. Keep the exact crop, terrain silhouettes, coordinates, coastline shapes, roads, river widths, building footprints and camera of Image 1. This is a zoomed detail restoration of that crop, not a new map. Structures cut by the crop boundary MUST remain cut at precisely the same points. Never recenter or fit a cut-off feature entirely into the picture.
Rendering: grounded hand-painted realism with crisp natural surfaces and fine material differentiation: rock strata, scree, weathered masonry, individual tree branches and crowns, little roof tiles and windows, hedges and pasture plots, distinct dirt tracks, tiny docks and bridges, coherent sea currents and fine foam. Preserve the existing warm upper-left sunlight and the exact brightness/palette: deep cobalt blue sea with teal shallows, earthy green vegetation, pale ivory snow, antique gold and aged stone. Sharply resolve the details without adding artificial texture grain, painterly smears, over-sharpening halos, depth-of-field blur or haze over the playable land.
Seam requirement: this is one crop from a single larger painting. Retain the precise content along ALL FOUR EDGES of Image 1, down to the coast intersections, tree placements, mountain and building silhouettes. Outer-edge lighting, colors and geometry must remain unchanged so neighboring crops can connect. Add detail within the already established forms, without repositioning anything.
Output: one borderless landscape image, exact 3:2 aspect ratio, request maximum native resolution / 4K detail. No text, labels, pins, typography, compass, UI, frame, panels, grid or watermark. Do not show equipment or standalone reference objects.
Quarter content: NORTHEAST QUARTER ONLY. Preserve the broad northern ocean across the upper part, the violet-stone ruined plateau and forest camp peninsula in the left and center, and the towering black gothic volcanic fortress on the right. Its lower lava cliffs are clipped at the bottom edge; the golden citadel is clipped at the lower-left. Fine ruined arches, ash woods, palisades, roads, bridges, basalt columns, gothic stonework and glowing lava in the existing channels. Do not complete the cut-off castle bases or create another volcano.
```

## bottom-left

References, in order: `guides/bottom-left.png`, `source/world-layout-master.png`, `public/assets/homepage/market-quay-v1.png`, `public/assets/items/weapons/ogre-cleaver-atlas-v1.png`. The first two paths are relative to this directory; the others are relative to the repository.

```text
Use case: style-transfer.
Asset type: one high-detail quarter of the existing Aergyle MMORPG atlas, part of a seamless 2-by-2 world.
Input images: Image 1 is the exact cropped EDIT TARGET and strict spatial guide. Image 2 is the complete approved world-layout reference only; do NOT render the whole world. Image 3 is the existing game's market-quay environment STYLE reference. Image 4 is the game's weathered equipment material STYLE reference only.
Primary request: Redraw Image 1 alone with far more resolved local detail and the premium realistic fantasy rendering of the game assets. Keep the exact crop, terrain silhouettes, coordinates, coastline shapes, roads, river widths, building footprints and camera of Image 1. This is a zoomed detail restoration of that crop, not a new map. Structures cut by the crop boundary MUST remain cut at precisely the same points. Never recenter or fit a cut-off feature entirely into the picture.
Rendering: grounded hand-painted realism with crisp natural surfaces and fine material differentiation: rock strata, scree, weathered masonry, individual tree branches and crowns, little roof tiles and windows, hedges and pasture plots, distinct dirt tracks, tiny docks and bridges, coherent sea currents and fine foam. Preserve the existing warm upper-left sunlight and the exact brightness/palette: deep cobalt blue sea with teal shallows, earthy green vegetation, pale ivory snow, antique gold and aged stone. Sharply resolve the details without adding artificial texture grain, painterly smears, over-sharpening halos, depth-of-field blur or haze over the playable land.
Seam requirement: this is one crop from a single larger painting. Retain the precise content along ALL FOUR EDGES of Image 1, down to the coast intersections, tree placements, mountain and building silhouettes. Outer-edge lighting, colors and geometry must remain unchanged so neighboring crops can connect. Add detail within the already established forms, without repositioning anything.
Output: one borderless landscape image, exact 3:2 aspect ratio, request maximum native resolution / 4K detail. No text, labels, pins, typography, compass, UI, frame, panels, grid or watermark. Do not show equipment or standalone reference objects.
Quarter content: SOUTHWEST QUARTER ONLY. Preserve the central gold-roofed walled citadel clipped at the top-right; western meadowland, oak and pine groves, farms, winding roads, stone bridges and coastal hamlets; the ochre rocky southern peninsula with its turquoise crater lagoon; the pirate-island headland entering at bottom-left and the blue southern sea. Preserve every coastal channel and road. Resolve tiny pastoral and fishing settlement details at a believable atlas scale. Do not complete the cut-off central citadel.
```

## bottom-right

References, in order: `guides/bottom-right.png`, `source/world-layout-master.png`, `public/assets/homepage/market-quay-v1.png`, `public/assets/items/weapons/ogre-cleaver-atlas-v1.png`. The first two paths are relative to this directory; the others are relative to the repository.

```text
Use case: style-transfer.
Asset type: one high-detail quarter of the existing Aergyle MMORPG atlas, part of a seamless 2-by-2 world.
Input images: Image 1 is the exact cropped EDIT TARGET and strict spatial guide. Image 2 is the complete approved world-layout reference only; do NOT render the whole world. Image 3 is the existing game's market-quay environment STYLE reference. Image 4 is the game's weathered equipment material STYLE reference only.
Primary request: Redraw Image 1 alone with far more resolved local detail and the premium realistic fantasy rendering of the game assets. Keep the exact crop, terrain silhouettes, coordinates, coastline shapes, roads, river widths, building footprints and camera of Image 1. This is a zoomed detail restoration of that crop, not a new map. Structures cut by the crop boundary MUST remain cut at precisely the same points. Never recenter or fit a cut-off feature entirely into the picture.
Rendering: grounded hand-painted realism with crisp natural surfaces and fine material differentiation: rock strata, scree, weathered masonry, individual tree branches and crowns, little roof tiles and windows, hedges and pasture plots, distinct dirt tracks, tiny docks and bridges, coherent sea currents and fine foam. Preserve the existing warm upper-left sunlight and the exact brightness/palette: deep cobalt blue sea with teal shallows, earthy green vegetation, pale ivory snow, antique gold and aged stone. Sharply resolve the details without adding artificial texture grain, painterly smears, over-sharpening halos, depth-of-field blur or haze over the playable land.
Seam requirement: this is one crop from a single larger painting. Retain the precise content along ALL FOUR EDGES of Image 1, down to the coast intersections, tree placements, mountain and building silhouettes. Outer-edge lighting, colors and geometry must remain unchanged so neighboring crops can connect. Add detail within the already established forms, without repositioning anything.
Output: one borderless landscape image, exact 3:2 aspect ratio, request maximum native resolution / 4K detail. No text, labels, pins, typography, compass, UI, frame, panels, grid or watermark. Do not show equipment or standalone reference objects.
Quarter content: SOUTHEAST QUARTER ONLY. Preserve the central blue channel and warm southern island chain with Crownhold's small pale-stone city, bridges and quays; the blue/teal coastal stronghold to the upper-right; the black fortress's lower molten cliffs and lava falls entering from the top-right; and the broad southern ocean and outer cloud wisps. The gold central castle is clipped at top-left. Add fine weathered slate roofs, stone bridge arches, courtyard streets, dock planks, coastal rocks and fine surf only within the existing geometry. Do not complete the cropped eastern fortress or introduce another landmass.
```

## Seam repair: north

Edit target: `guides/seam-north.png`.

```text
Use case: precise-object-edit.
Input image 1 is the EDIT TARGET: a cropped part of a high-detail Aergyle world atlas assembled from enlarged paintings. Edit this exact image, maintaining its exact 1536 x 1024 framing and scene geometry. The geography, architectural scale, camera, shapes, all roads, bridges, islands, trees, shorelines, sea colors, warm upper-left lighting and sharp realistic-fantasy rendering are locked.
Task: repair the specified internal stitching join so this is one perfectly continuous painting. Resolve cut/doubled objects, interrupted coastlines, disconnected masonry/roads and abrupt light/color changes only around that join. Reconnect the existing structures naturally without adding a new landmark or moving anything. Keep the imagery outside the join unchanged. Preserve the content on the four outer edges exactly. Do not zoom, recenter, rescale, change perspective or show the rest of the world. Fine natural stone, leaf and sea detail must stay crisp; do not smooth the image or introduce any blur.
Output: one seamless 3:2 landscape image of exactly this crop. No grid, border, frame, text, labels, UI, map pins, watermark or added objects.
Join to repair: Repair the vertical join at x=768 (the middle of the image), running from the top to bottom. There is a conspicuous abrupt bright patch in the clouds and northern sea immediately to the right of this join. Make the northern clouds and sea illumination flow naturally across the join, retaining the blue daylight values of the left side and avoiding a second sunrise at image center. The volcano slopes and their coastal rocks must continue across the join. Keep the volcano itself at its existing position. At the lower part, reconnect the violet ruined land and green field paths crossing the line. Restrict geometric changes to a narrow band of about 120 pixels on each side of x=768; illumination may taper smoothly slightly farther.
```

## Seam repair: south

Edit target: `guides/seam-south.png`.

```text
Use case: precise-object-edit.
Input image 1 is the EDIT TARGET: a cropped part of a high-detail Aergyle world atlas assembled from enlarged paintings. Edit this exact image, maintaining its exact 1536 x 1024 framing and scene geometry. The geography, architectural scale, camera, shapes, all roads, bridges, islands, trees, shorelines, sea colors, warm upper-left lighting and sharp realistic-fantasy rendering are locked.
Task: repair the specified internal stitching join so this is one perfectly continuous painting. Resolve cut/doubled objects, interrupted coastlines, disconnected masonry/roads and abrupt light/color changes only around that join. Reconnect the existing structures naturally without adding a new landmark or moving anything. Keep the imagery outside the join unchanged. Preserve the content on the four outer edges exactly. Do not zoom, recenter, rescale, change perspective or show the rest of the world. Fine natural stone, leaf and sea detail must stay crisp; do not smooth the image or introduce any blur.
Output: one seamless 3:2 landscape image of exactly this crop. No grid, border, frame, text, labels, UI, map pins, watermark or added objects.
Join to repair: Repair the vertical join at x=768 (middle of image), from top to bottom: coherent ocean wave directions, foam and shallow colors across it; join the small coastline, rock and shore features near this line without cuts. Preserve every landform. Restrict changes to about 100 pixels on each side of x=768. Keep the buildings, islands, city walls, ships and lighthouse in exactly their existing positions.
```

## Seam repair: west

Edit target: `guides/seam-west.png`.

```text
Use case: precise-object-edit.
Input image 1 is the EDIT TARGET: a cropped part of a high-detail Aergyle world atlas assembled from enlarged paintings. Edit this exact image, maintaining its exact 1536 x 1024 framing and scene geometry. The geography, architectural scale, camera, shapes, all roads, bridges, islands, trees, shorelines, sea colors, warm upper-left lighting and sharp realistic-fantasy rendering are locked.
Task: repair the specified internal stitching join so this is one perfectly continuous painting. Resolve cut/doubled objects, interrupted coastlines, disconnected masonry/roads and abrupt light/color changes only around that join. Reconnect the existing structures naturally without adding a new landmark or moving anything. Keep the imagery outside the join unchanged. Preserve the content on the four outer edges exactly. Do not zoom, recenter, rescale, change perspective or show the rest of the world. Fine natural stone, leaf and sea detail must stay crisp; do not smooth the image or introduce any blur.
Output: one seamless 3:2 landscape image of exactly this crop. No grid, border, frame, text, labels, UI, map pins, watermark or added objects.
Join to repair: Repair the horizontal join at y=512 (middle of image), running left to right: continuous tree crowns and pasture paths across it, natural unbroken coastline at the left, and clean connected golden citadel walls and roofs at the right. Repair small mismatches without changing overall building design or footprint. Restrict changes to about 110 pixels above and below y=512. Retain the mountain, lake and forest, village and farmland, sea and citadel positions and sizes exactly.
```

## Seam repair: center

Edit target: `guides/seam-center.png`.

```text
Use case: precise-object-edit.
Input image 1 is the EDIT TARGET: a cropped part of a high-detail Aergyle world atlas assembled from enlarged paintings. Edit this exact image, maintaining its exact 1536 x 1024 framing and scene geometry. The geography, architectural scale, camera, shapes, all roads, bridges, islands, trees, shorelines, sea colors, warm upper-left lighting and sharp realistic-fantasy rendering are locked.
Task: repair the specified internal stitching join so this is one perfectly continuous painting. Resolve cut/doubled objects, interrupted coastlines, disconnected masonry/roads and abrupt light/color changes only around that join. Reconnect the existing structures naturally without adding a new landmark or moving anything. Keep the imagery outside the join unchanged. Preserve the content on the four outer edges exactly. Do not zoom, recenter, rescale, change perspective or show the rest of the world. Fine natural stone, leaf and sea detail must stay crisp; do not smooth the image or introduce any blur.
Output: one seamless 3:2 landscape image of exactly this crop. No grid, border, frame, text, labels, UI, map pins, watermark or added objects.
Join to repair: Repair both joins that cross at the image center: vertical x=768 and horizontal y=512. Make the central golden citadel's right and lower walls, roofs, quays and adjoining roads perfectly continuous; correct any cut or duplicated masonry. Connect the neighboring coastlines, roads, forest and sea currents coherently across the cross. Restrict edits to about 110 pixels on each side of the two lines. The golden citadel at left of center must stay precisely in place with its existing scale and towers. Preserve all geometry and the four outer edges.
```

## Seam repair: east

Edit target: `guides/seam-east.png`.

```text
Use case: precise-object-edit.
Input image 1 is the EDIT TARGET: a cropped part of a high-detail Aergyle world atlas assembled from enlarged paintings. Edit this exact image, maintaining its exact 1536 x 1024 framing and scene geometry. The geography, architectural scale, camera, shapes, all roads, bridges, islands, trees, shorelines, sea colors, warm upper-left lighting and sharp realistic-fantasy rendering are locked.
Task: repair the specified internal stitching join so this is one perfectly continuous painting. Resolve cut/doubled objects, interrupted coastlines, disconnected masonry/roads and abrupt light/color changes only around that join. Reconnect the existing structures naturally without adding a new landmark or moving anything. Keep the imagery outside the join unchanged. Preserve the content on the four outer edges exactly. Do not zoom, recenter, rescale, change perspective or show the rest of the world. Fine natural stone, leaf and sea detail must stay crisp; do not smooth the image or introduce any blur.
Output: one seamless 3:2 landscape image of exactly this crop. No grid, border, frame, text, labels, UI, map pins, watermark or added objects.
Join to repair: Repair the horizontal join at y=512 (middle of image), running left to right: connect sea currents and shorelines; align the black basalt cliff strata and glowing lava channels so they are continuous through the line. Restore any cut tree crowns or small coastal towers along it. Restrict changes to about 110 pixels above and below y=512. Preserve the existing huge dark fortress clipped at the top, the teal stronghold below, and the pale southern islands in their exact places.
```

