# Reusable Component Expansion v1

Five transparent inventory masters generated for reusable crafting materials.
Each item is intentionally designed as a normal world item rather than as a
single-recipe prop.

| Item             | Master                        | Runtime sprite                                                     |
| ---------------- | ----------------------------- | ------------------------------------------------------------------ |
| Wooden Handle    | `wooden-handle-master.png`    | `/assets/items/resources/components/wooden-handle-atlas-v1.png`    |
| Duskbound Handle | `duskbound-handle-master.png` | `/assets/items/resources/components/duskbound-handle-atlas-v1.png` |
| Dusk Oil         | `dusk-oil-master.png`         | `/assets/items/resources/alchemy/dusk-oil-atlas-v1.png`            |
| Tempering Resin  | `tempering-resin-master.png`  | `/assets/items/resources/resins/tempering-resin-atlas-v1.png`      |
| Hardened Leather | `hardened-leather-master.png` | `/assets/items/resources/textiles/hardened-leather-atlas-v1.png`   |

The masters are 1254×1254 RGBA PNGs. Runtime sprites are cropped from their
alpha bounds, scaled into a roughly 210px safe area, centered on transparent
256×256 canvases, and retained as RGBA PNGs.

`Duskbound Handle` was generated in edit/composite mode using the Wooden
Handle, Elderwood Plank, Dusk Oil, and Hardened Leather as visual references.
The other four assets were generated as new transparent-background images.

See [PROMPTS.md](./PROMPTS.md) for the final prompts and
[`generation.json`](./generation.json) for provenance.
