# Enchanting frame layers

The enchanting UI is supplied as three transparent, matching pieces:

| Asset | Role |
| --- | --- |
| `enchant-material-frame.png` | Left material slot; stepped routes lead into its short right-facing exit. |
| `enchant-charge-channel.png` | Middle horizontal channel, with fully transparent fill lane. |
| `enchant-target-frame.png` | Compact right target frame only, including short integrated rail terminals and top/bottom caps. |

Place the material and target item sprites in the transparent square openings.
Every fill route is also truly transparent (alpha 0), rather than a dark painted
trough. Put the blue animated fill *behind* these metal layers, then clip or
mask it along the desired route: left material frame → middle channel → target
frame. Each PNG contains only its metal ornament; it contains no pre-filled
energy or opaque fill surface.
