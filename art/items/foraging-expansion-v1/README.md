# Foraging expansion v1 artwork

Twenty-six isolated transparent masters were generated with the built-in image
generator on 2026-10-19 for Aergyle's Wayfarer's Atlas. Each master is retained
here; the matching runtime sprite is a deterministic 256×256 RGBA PNG below
`public/assets/items/resources/{fruits,herbs}`.

## Shared prompt

> Create one isolated RPG inventory resource sprite for Aergyle's Wayfarer's
> Atlas. Use a premium hand-painted, lightly faceted dark-fantasy style with a
> chunky readable silhouette, believable natural anatomy, restrained color,
> warm upper-left light, and a subtle contact shadow. Center the specimen with
> generous padding on a truly transparent background. No scenery, ground,
> frame, pedestal, glow, particles, text, letters, numbers, watermark, or
> rarity effects. Keep it legible at 48 pixels in a square composition.

## Master to runtime mapping

### Fruits

`apple`, `pear`, `strawberries`, `blueberries`, `raspberries`, `grapes`,
`figs`, `peaches`, `blood-oranges`, `pomegranates`, `golden-dates`,
`frostberries`, `cloudberries`, `moon-melon`, `starfruit`, and `orange` each map from
`<slug>-master.png` to
`public/assets/items/resources/fruits/<slug>-foraging-v1.png`.

### Herbs

`basil`, `wild-chives`, `lemon-balm`, `marjoram`, `tarragon`,
`stinging-nettle`, `wintergreen`, `icecap-moss`, `cinderleaf`, and
`ghost-orchid` each map from `<slug>-master.png` to
`public/assets/items/resources/herbs/<slug>-foraging-v1.png`.

Subject-specific prompts called out the distinctive fruit form or herb anatomy
(for example, the starfruit cross-section, icecap moss spore stalks, and ghost
orchid blooms) while retaining the shared inventory-icon constraints.

On 2026-10-20, `apple`, `peaches`, `pear`, `strawberries`, `blood-oranges`,
`pomegranates`, and `figs` were regenerated as single-fruit sprites. The
pomegranate is the sole open-fruit exception; `orange` was added as a distinct
normal-orange item rather than a variant of Blood Oranges.
