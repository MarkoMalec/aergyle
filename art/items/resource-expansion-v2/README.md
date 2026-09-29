# Resource expansion v2 artwork

Generated with the built-in image-generation tool, one transparent master per
request. Masters are 1254×1254 RGBA PNGs; the runtime exports were trimmed,
scaled to a 212px maximum subject dimension, and centred on a transparent
256×256 RGBA canvas.

All prompts used the Aergyle “Wayfarer’s Atlas” field-specimen direction:
orthographic-like three-quarter view, warm upper-left key light, cool
teal-grey self-shadow, broad faceted painted planes, natural restrained
materials, and no scenery, ground, cast shadow, border, text, effects, or UI.
The assembled generation prompts are retained in [PROMPTS.md](PROMPTS.md).

| Master                        | Subject brief                                                |
| ----------------------------- | ------------------------------------------------------------ |
| `sunstone-ore-master.png`     | Charcoal ore chunk with contained amber mineral seams.       |
| `umbracite-ore-master.png`    | Ash-grey volcanic ore with smoky violet mineral plates.      |
| `tideglass-ore-master.png`    | Black-blue island stone with sea-green glassy deposits.      |
| `sunsteel-ingot-master.png`   | Practical straw-gold steel bar with blue-grey underside.     |
| `umbrasteel-ingot-master.png` | Charcoal forged bar with contained muted plum grain.         |
| `tideglass-ingot-master.png`  | Blue-black alloy bar with sealed sea-glass inset faces.      |
| `gloamwood-log-master.png`    | Plum-brown log with rosewood cut end.                        |
| `ironbark-log-master.png`     | Dense grey-barked natural log with honey-coloured heartwood. |
| `saltcedar-log-master.png`    | Blue-grey coastal cedar log with muted red heartwood.        |
| `gloamwood-plank-master.png`  | Thick dark rosewood carpentry board.                         |
| `ironbark-plank-master.png`   | Dense honey-brown board with grey bark remnants.             |
| `saltcedar-plank-master.png`  | Weathered coastal cedar board with muted red heartwood.      |

Runtime exports are under `public/assets/items/resources/{ores,ingots,logs,planks}`.
