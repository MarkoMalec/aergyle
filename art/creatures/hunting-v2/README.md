# Hunting animal artwork v2

Generated with the built-in image-generation tool, one transparent master per
request. Masters are 1254×1254 RGBA PNGs; runtime copies are trimmed, scaled to
a 212px maximum subject dimension, and centred on a transparent 256×256 RGBA
canvas.

Shared visual direction: a complete anatomically legible animal in an alert
three-quarter pose, faceted painted planes, a chunky silhouette, restrained
natural colour, warm upper-left light and cool lower-right shadow. The prompt
excluded scenery, ground, contact or cast shadow, glow, particles, equipment,
text, borders, and UI.
The assembled generation prompts are retained in [PROMPTS.md](PROMPTS.md).

| Master                        | Subject brief                                                       |
| ----------------------------- | ------------------------------------------------------------------- |
| `briarback-badger-master.png` | Low brown badger with pale head stripe and bramble-tough shoulders. |
| `snowhorn-ram-master.png`     | Stone-grey alpine ram with clear pale spiral horns.                 |
| `ruin-viper-master.png`       | Thick olive-and-sandstone viper with dark crown chevron.            |
| `cinder-jackal-master.png`    | Lean soot-brown jackal with ash-grey throat.                        |
| `mangrove-panther-master.png` | Blue-black stalking panther with restrained tide-grey rosettes.     |

Runtime exports are in `public/assets/creatures/animals`.
