# Aergyle homepage art, v1

Six paintings for the homepage (`src/app/page.tsx`, scenes in
`src/components/landing/scenes.tsx`) and one optional share image. They replace
`homepage/background1.jpg` on the homepage. The `/play` sign-in page still uses
that image.

The page tells one day in Aergyle: arriving at dawn, gathering at first light,
crafting at noon, the road after midday, trade towards evening, dungeons at
dusk, the wayfarer working through the night, and an atlas whose last page is
still blank. Each painting is one beat of that day, so the light moves from dawn
gold to midday, golden hour, violet dusk, moonlight and finally candlelight.

## How the slots work

- Put the finished file in `public/assets/homepage/` under the exact name given
  below. `.png`, `.webp` and `.jpg` are all picked up, so the PNG straight out of
  the image tool is fine. `next/image` resizes and converts it for each screen.
- Until a file exists, the slot shows a CSS stand-in with the same light and the
  same quiet areas. In development it also shows a dashed outline labelled
  `art: <name>`. Production never shows the label.
- Keep each untouched master and its final prompt in this folder
  (`art/homepage-v1/<name>.png` plus notes), as the skill-header set does.
- The image cache keeps files for a month. If you replace art after it has gone
  live, save it as `-v2` and change the name in `scenes.tsx`. Don't overwrite
  `-v1`.
- Generate at the largest landscape size the tool offers (at least 1536×1024).
  If it can go larger or upscale, 2560 px wide is ideal for full-width scenes.

## Shared style (matches the existing game art)

The skill banners (`public/assets/skills/*-header.webp`), the NPC portraits and
the world map (`public/assets/world/world-map-v1.png`) set the look. Their shared
language is premium, grounded, semi-realistic painterly fantasy: believable
materials, simplified readable forms, soft painterly treatment, warm light
against cool teal shadow. Every prompt below starts with this paragraph:

```text
Premium hand-painted fantasy RPG environment art for the browser game Aergyle,
in its "Wayfarer's Atlas" direction: a grounded, lived-in medieval-fantasy world
with believable materials, simplified readable forms and a soft painterly
treatment — broad confident brushwork and lightly faceted planes, semi-realistic
rather than photographic. Rich but controlled colour: deep green-black and teal
shadows, warm brass and amber light, parchment-coloured highlights, atmospheric
haze for depth. Cinematic wide composition with one clear focal area and large
calm areas of value. No photorealism, no glossy 3D render look, no anime, no
pixel art, no thick outlines, no lens flares, no chromatic aberration, no bloom
haze over everything. No text, letters, numbers, runes that read as writing,
signage, logos, UI, borders, frames, watermarks or signatures.
```

### The wayfarer (same woman in every image she appears in)

```text
The wayfarer: an adult woman in her early thirties, grounded build, weathered
light-olive skin, dark auburn hair in a loose low braid with a few strands
free. Violet-indigo wool travelling cloak with a frayed hem and a single brass
clasp; sand-coloured linen shirt; dark brown leather jerkin; moss-green wool
trousers; worn brown boots; a canvas-and-leather backpack with a rolled grey
bedroll strapped on top; a plain iron felling axe on her belt; a small brass
compass on a cord. Practical and travel-worn, not armoured, not glamorous; a
newcomer with quiet resolve.
```

---

## 1. `hero-dawn-v1`: the valley at dawn (new homepage background)

**Where:** the full first screen, behind the headline "The world is wide. Your
pack is empty." It replaces `background1.jpg` there.

**Size:** landscape 3:2 master, 1536×1024 minimum (2560×1707 ideal). No people;
the wayfarer is a separate layer (asset 2).

**What the page does to it:**
- Desktop: it fills the whole viewport and is cropped to about 16:9 around a
  point 64% from the left. A dark gradient covers the left 0–36% (headline and
  buttons sit at the lower left). The top 20% is dimmed under the navigation,
  and the bottom half fades into the page colour `#111B1E`.
- The wayfarer cutout stands in the lower right, covering roughly x 62–92% and
  y 16–100%.
- Phones: only a portrait slice from about x 40% to 88% is visible, in the top
  two thirds of the screen.

**Composition map:**
- **Focal area, x 50–80%, y 40–62%:** the walled city of Crownhold on the coast
  in the middle distance, with the low sun just above the sea horizon at about
  x 70%, y 52%, slightly right of the city.
- **Left third:** darker, cooler dawn sky and shadowed hills. Keep it calm and
  low in contrast so text reads over it. No bright cloud edges here.
- **Far left distance, x 5–30%, y 25–40%:** the ice-bright Frostcrown summits,
  faint and blue in the haze.
- **Middle ground:** the Greenveil Plains. A broad valley of meadows and oak
  copses, an old cart road winding down towards the city, a clear river
  catching the light, thin mist lying in the low ground.
- **Bottom 30%:** dark foreground in shadow (heather, rock, grass). The lower
  right holds a dark rocky shoulder where the wayfarer's ledge will join it.
  Nothing important goes here.

**Light & palette:** a low sunrise from the right-centre backlighting the
valley. Warm gold and amber at the horizon and on the river; cool teal-blue sky
and shadow on the left; long shadows that read as early morning. Hopeful, vast,
inviting: the first morning of a long journey.

**Prompt:**

```text
[shared style paragraph]

A sweeping dawn landscape seen from a high ridge, looking down across a wide
fantasy river valley towards the sea. In the middle distance, centre-right, a
walled wayfarer's city on the coast where the southern roads meet the sea: warm
stone walls, slate and terracotta roofs, three stone bridge gates over a river
mouth, quays with a few tall-masted ships, thin chimney smoke. The low sun sits
just above the sea horizon slightly right of the city, backlighting everything
with warm gold and amber; the river and the sea catch long glittering paths of
light. Between the viewer and the city: broad meadowland broken by oak copses,
clear streams and an old cart road winding down the valley, with thin morning
mist lying in the hollows. Far away on the left, ice-bright snow peaks fade into
blue haze. The sky is deep teal-blue on the left and upper area, warming to
pale gold and apricot near the sun, with a few soft high clouds and a small
line of distant birds. The left third of the image is calmer and darker, with
cool shadowed hills and no bright cloud edges. The bottom third is dark
foreground rock, heather and grass in shadow; the lower-right corner is a dark
rocky shoulder of the ridge. No people, no figures, no animals in the
foreground. Wide cinematic 3:2 landscape.
```

**Accept when:** the city and the sun are both inside x 45–85% (so phones still
see them); the left third is dark enough that parchment-white text stays
readable; the bottom-right rock is dark and plain enough for the cutout to
stand on; there are no figures.

---

## 2. `hero-wayfarer-v1`: the wayfarer on the ridge (transparent cutout)

**Where:** stands in the lower right of the hero, over asset 1, and drifts
slightly slower than the page on scroll (parallax). Desktop height is about 84%
of the screen; on phones she is anchored bottom-right and partly cropped.

**Size:** 1024×1536 portrait (2:3), **true transparency** (RGBA PNG). The
figure plus her rock ledge fill 88–94% of the height. The rock is cut straight
along the **bottom edge of the canvas**, so it continues off the bottom of the
screen.

**Pose & story:** "Your pack is empty." She has just arrived on the ridge and is
looking out over the valley for the first time. Show her from behind in
three-quarter view, turned towards the viewer's **left** (towards the city and
the sun in asset 1), so we mostly see her back, the pack and the cloak. Her face
is a lost profile: cheek and jaw line just visible, no detailed face. Her
weight is on one leg, one foot slightly forward on the rock. One hand rests on
the axe haft at her hip and the other holds a pack strap. The pack sits
visibly light, flap loosely tied. A morning breeze lifts the cloak and a few
strands of hair towards the right.

**Light (must match asset 1):** the low sun is in front of her and to the left,
so she is backlit. Her back is in cool teal-blue shadow, with a warm natural gold
rim of sunlight along her left-side edges (hair, shoulder, cloak edge, the top
of the axe head). No coloured neon rim, no glow.

**Prompt:**

```text
[shared style paragraph — keep the material and lighting rules, ignore the
landscape wording]

[wayfarer paragraph]

Full-body character art on a genuinely transparent background (RGBA, no
checkerboard, no white mat, no painted backdrop). She stands on a small dark
weathered rock ledge whose base is cut straight along the bottom edge of the
canvas. Rear three-quarter view: she is turned away from the viewer towards the
left, looking out over a valley we cannot see; we see mostly her back, her
backpack and her violet-indigo cloak, with only the edge of her cheek and jaw
visible in lost profile. Relaxed, confident stance, one foot slightly forward;
right hand resting on the haft of the iron felling axe at her hip, left hand on
a backpack strap. The backpack is clearly light and nearly empty, flap loosely
tied, grey bedroll on top. A breeze lifts the cloak hem and a few loose strands
of hair to the right. Backlit by a low warm sunrise from the front-left: cool
teal-blue shadow across her back, a thin warm gold rim of natural sunlight on
the left edges of her hair, shoulder, cloak and the axe head. Grounded
proportions, about seven heads tall, slightly enlarged hands and gear for
readability, painted planes and hair clumps, no skin pores. Figure and ledge
fill 90% of the canvas height, centred, with clear margins at the top and sides.
1024 by 1536 portrait.
```

**Accept when:** the alpha is clean over dark ink and over a bright sky (no
fringe, halo or baked shadow outside the rock); the rock base runs flat along
the canvas bottom; she is clearly turned to the left; the light agrees with
asset 1; she reads as the same person later in asset 5.

---

## 3. `market-quay-v1`: the Quay ward at golden hour

**Where:** the "Towards evening, the quay gets loud." scene about trade, the
marketplace and friends. Desktop: full width behind a section about 1.75:1,
centred 62% from the left. Phones: a banner of about 390×455 above the text
(roughly x 40–85% visible).

**What the page does to it:** the left 0–34% is inked dark for the headline,
the top 20% and bottom 40% fade into the page, and an opaque order-book card
floats over the right side (about x 62–95%, y 30–65%). **The art shows most
between x 35% and 75%.**

**Composition map:**
- **Focal, x 38–72%, y 25–60%:** the heart of the market. Canvas-awninged
  stalls on a stone quay, goods catching low sunlight.
- **Background, upper centre-right:** ship masts with furled sails, and one of
  Crownhold's stone bridge gates arching over the water.
- **Left third:** a darker shaded alley or arcade, quieter and cooler.
- **Bottom third:** cobbles in shadow; it will fade out.

**Content:** Crownhold's Quay ward market late in the afternoon. The goods are
the game's own: crates of reddish copper ore and dark cobalt ore; stacked
copper and iron ingots; bolts of moss-green and ember-red cloth; hanging dried
fish and a basket of river trout; amber and cobalt potion bottles; racked bows
and plain tools; a brass merchant's scale with a few coins. Lanterns are being
lit and string lights hang between stalls. People appear as small mid-distance
figures, busy and blurred in the warm light, with no detailed faces and
nobody posing. A couple of gulls fly overhead.

**Prompt:**

```text
[shared style paragraph]

A bustling harbour market on a stone quay in a walled medieval-fantasy port
city, late afternoon golden hour. Rows of canvas-awninged market stalls in
faded ochre, teal and brick-red stretch along the waterfront. The goods are
clear and tactile: open crates of reddish copper ore and dark blue-grey cobalt
ore, stacked copper and iron ingots, bolts of moss-green and ember-red cloth,
hanging dried fish and a wicker basket of river trout, amber and cobalt glass
potion bottles on a shelf, a rack of wooden bows and simple iron tools, a brass
merchant's scale with a few coins. Lanterns are just being lit; warm string
lights between the stalls. Behind the market, tall ship masts with furled sails
and a stone bridge gate arching over the harbour water, warm sun raking low
from the upper right across the awnings and casting long shadows. Townsfolk are
small mid-distance figures going about their trade, softly painted, no detailed
faces, nobody looking at the viewer. The left third is a cooler, darker shaded
arcade; the busiest, brightest part of the market sits in the centre and
centre-right. Two gulls in the sky. No readable signs or lettering on anything.
Wide cinematic 3:2 landscape.
```

**Accept when:** the busiest, brightest part sits between x 38% and 72%; the
left third is dark; nothing in the image looks like writing.

---

## 4. `dungeon-descent-v1`: the stair into the Caldrath Undervaults

**Where:** "At dusk, some roads go underground." Desktop: full width behind a
tall section (about 1.6:1), centred at 58% across and 45% down. The headline
sits at the top left. **Six creature cutouts** (spider, minotaur, wyrm, hydra,
troll, sentinel) stand in a row across the bottom quarter over this painting.
Phones: a banner of about 390×455 above the text.

**Composition map:**
- **Focal, x 45–80%, y 15–65%:** a massive ruined archway in violet-grey stone
  with a broad stair descending into a flooded vault. Torchlight is on either
  side; below, a faint sickly teal-green glow comes from the ooze channels deep
  inside.
- **Top-left, x 0–40%, y 0–45%:** dark quiet masonry and dusk sky. This is
  where the headline sits.
- **Bottom 30%:** a dark, fairly even floor of wet flagstones and black
  standing water with only small reflections. The creatures will stand on it,
  so keep it uncluttered and low in contrast.
- **Top edge:** broken terraces and roofless halls of Caldrath against a
  violet-indigo dusk sky with the last ember light.

**Story:** Ruins of Caldrath, "broken terraces and roofless halls spread through
a violet-stone basin". Under it lie the Caldrath Undervaults: "flooded vaults
under Caldrath's broken terraces, where ooze drifts down the old channels". The
place is dangerous and tempting, the kind of door you walk through anyway.

**Prompt:**

```text
[shared style paragraph]

Dusk at the entrance to a flooded underground vault beneath ancient ruins. A
massive half-collapsed archway of violet-grey stone stands centre-right, with a
broad worn stone stair descending through it into darkness and still black
water. Iron braziers on either side of the arch burn with warm orange firelight
that catches wet stone, hanging roots and moss. Deep inside, far below, old
water channels give off a faint sickly teal-green glow. Above, broken terraces
and roofless halls of a ruined violet-stone city rise against a deep
violet-indigo dusk sky with a last thin band of ember light on the horizon.
The upper-left area is dark, quiet masonry and sky with little detail. The
lower third is an even, dark floor of wet flagstones and shallow black water
with only small reflections of the firelight, open and uncluttered. Ominous,
adventurous mood; no creatures, no skeletons, no bodies, no gore, no people.
Wide cinematic 3:2 landscape.
```

**Accept when:** the archway and torches sit between x 45% and 80%; the top
left is dark and quiet; the bottom 30% is plain and dark enough for six
creature cutouts to read on it.

---

## 5. `night-camp-v1`: she keeps working through the night

**Where:** "At nightfall, close the tab. Your wayfarer won't." This beat shows
idle progress. The headline and a "While you were away" card (8 hours of Copper
Ore mining) sit in the **right-hand column**. Desktop: full width, about 1.67:1,
centred 36% from the left, with the right 0–38% heavily inked. Phones: a banner
showing roughly x 10–62%.

**Composition map:**
- **Focal, x 15–55%, y 30–75%:** the wayfarer, small in the frame (about 22% of
  the image height), seen from behind and to the side. She swings a pickaxe at
  a copper vein in a rocky outcrop by the river, lit by a lantern hanging from a
  crooked pole. The copper veins glint warm orange.
- **Camp beside her, slightly lower left:** a small campfire burning low, her
  backpack now bulging full, a sack of reddish copper ore spilling a few stones,
  a bedroll, and a fishing rod propped on a forked stick with its line in the
  moonlit water.
- **Right 40%:** quiet night. A calm river with a soft moon reflection, distant
  dark hills, and far on the horizon the silhouette of a many-towered
  stronghold (the Citadel, where copper is mined) with a few tiny warm windows.
  This side stays dark and low in contrast.
- **Sky:** deep blue-black with a scatter of stars and a moon in the upper
  centre-left. No Milky Way spectacle.

**Light:** cool moonlight blue over everything, with two warm sources (lantern
and campfire) concentrated in the left-centre. The wayfarer is lit warm from the
lantern on one side and cool from the moon on the other.

**Prompt:**

```text
[shared style paragraph]

[wayfarer paragraph]

A riverside night scene under a deep blue-black starry sky with a bright moon
in the upper centre-left. In the left-centre of the image, the wayfarer is
still at work: seen from behind and slightly to the side, small in the frame,
she swings an iron pickaxe at glinting orange copper veins in a mossy rocky
outcrop at the river's edge, lit by a hooded lantern hanging from a crooked
wooden pole beside her. Next to her, slightly lower and to the left, her small
camp: a low campfire, her canvas backpack now bulging full, an open sack of
reddish copper ore spilling a few stones onto the grass, a rolled grey
bedroll, and a fishing rod propped on a forked stick with its line in the
moonlit water. Warm lantern and fire light pool around her against cool blue
moonlight everywhere else. The right side of the image is calm and dark: the
quiet river with a soft moon reflection, distant dark hills, and on the far
horizon the silhouette of a many-towered stronghold with a few tiny warm
windows. Peaceful, diligent, cosy-but-lonely mood. Wide cinematic 3:2
landscape.
```

**Accept when:** she and the camp sit inside x 15–55% and read at small size;
the right 40% is dark and calm; she matches the woman in asset 2 (cloak colour,
braid, pack).

---

## 6. `atlas-last-page-v1`: the blank page (closing image)

**Where:** the closing call to action, "The day ends. The story doesn't." with
the button "Write your first page". Desktop: full width, about 1.75:1, centred
70% from the left. Text sits on the **left** (x 0–45%, inked dark). Phones: a
banner showing roughly x 45–95%, with the headline overlapping its lower edge.

**Composition map:**
- **Focal, x 42–97%, y 22–92%:** a large open leather-bound atlas on a dark oak
  table at night, seen from about 35° above, slightly angled. The **left-hand
  page** is filled with a hand-inked and watercoloured map fragment of Aergyle
  (coastline, a river delta, snowy mountains, a small volcano island) in the
  style of an old explorer's atlas. The **right-hand page is blank**: warm
  parchment with faint ruled guide lines, the brightest surface in the image.
- **Props around the book:** a quill resting in a brass inkpot beside the blank
  page, a small brass compass, a chunk of copper ore and a pressed wildflower as
  keepsakes, worn leather gloves at the edge, and a candle in a brass holder at
  the upper right (about x 85%, y 18%) as the only light source.
- **Left 40%:** falls off into deep warm shadow (dark oak, darkness), with no
  objects or highlights. The headline goes here.

**Light:** a single candle from the upper right; warm amber on parchment and
brass, deep umber and teal-black shadows. Quiet, intimate, the end of a long
day.

**Prompt:**

```text
[shared style paragraph]

A candlelit still life at night on a dark, scarred oak table. A large open
leather-bound atlas fills the right half of the image, seen from about 35
degrees above at a slight angle. The left-hand page is covered in a hand-inked,
softly watercoloured map of a fantasy land — winding coastline, a river delta,
snowy mountains, a small volcanic island — like an old explorer's atlas, with
no readable labels or lettering. The right-hand page is completely blank: warm
parchment with only faint ruled guide lines, the brightest surface in the
image. A goose-feather quill rests in a small brass inkpot beside the blank
page; around the book lie a small brass compass, a chunk of reddish copper ore,
a pressed wildflower and a pair of worn leather gloves. A single candle in a
brass holder at the upper right is the only light, throwing warm amber light
across the pages and long soft shadows. The left 40 percent of the image falls
off into deep warm shadow with no objects or highlights. Quiet, intimate,
hopeful end-of-day mood. Wide cinematic 3:2 landscape.
```

**Accept when:** the blank right-hand page is clearly blank and the brightest
area; nothing anywhere reads as text; the left 40% is dark and empty; the book
sits within x 42–97%.

---

## 7. `og-aergyle-v1` (optional): link preview

**Where:** shown when someone shares the homepage link on Discord, X, WhatsApp
and so on. It is only added to the page's metadata once the file exists.

**Size:** 1200×630 JPG.

**How:** this doesn't need its own generation. Once assets 1 and 2 exist, it can
be composed from them: the valley with the wayfarer standing right of centre,
cropped so the city, the sun and the figure sit inside the middle 60% (platforms
crop the edges). No text in the image. Ask for it once the hero is in and it can
be built from the two files.
