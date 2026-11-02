import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Offline packaging only. All artwork and local seam repairs were made with
// the built-in image-generation tool. The untouched outputs are in source/.
const root = fileURLToPath(new URL("./", import.meta.url));
const runtime = fileURLToPath(new URL("../../public/assets/world/atlas-v2/", import.meta.url));
const native = { width: 3072, height: 2048 };
const full = { width: 7680, height: 5120 };
const tile = { width: 3840, height: 2560 };
const quarters = [
  { id: "top-left", column: 0, row: 0 },
  { id: "top-right", column: 1, row: 0 },
  { id: "bottom-left", column: 0, row: 1 },
  { id: "bottom-right", column: 1, row: 1 },
];

const smooth = (x) => {
  const v = Math.max(0, Math.min(1, x));
  return v * v * (3 - 2 * v);
};
const ribbon = (distance, core, feather) =>
  1 - smooth((Math.abs(distance) - core) / feather);

async function repair(name, orientation, left, top) {
  const width = 1536;
  const height = 1024;
  const alpha = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const vertical = ribbon(x - 768, name === "north" ? 180 : 100, 96);
      const horizontal = ribbon(y - 512, 100, 80);
      let value = orientation === "vertical" ? vertical
        : orientation === "horizontal" ? horizontal
          : Math.max(vertical, horizontal);
      // Only fade where a repair meets the painting's interior; keep full
      // coverage when the repair ribbon touches the outer world boundary.
      if (left > 0) value *= smooth(x / 96);
      if (top > 0) value *= smooth(y / 96);
      if (left + width < native.width) value *= smooth((width - 1 - x) / 96);
      if (top + height < native.height) value *= smooth((height - 1 - y) / 96);
      alpha[y * width + x] = Math.round(value * 255);
    }
  }
  const input = await sharp(`${root}source/seam-${name}-generated.png`)
    .removeAlpha()
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  return { input, left, top };
}

await mkdir(runtime, { recursive: true });
const base = await sharp({ create: { ...native, channels: 3, background: "#12354b" } })
  .composite(quarters.map(({ id, column, row }) => ({
    input: `${root}source/${id}-generated.png`,
    left: column * 1536,
    top: row * 1024,
  })))
  .png()
  .toBuffer();

const overlays = [
  await repair("north", "vertical", 768, 0),
  await repair("south", "vertical", 768, 1024),
  await repair("west", "horizontal", 0, 512),
  await repair("east", "horizontal", 1536, 512),
  await repair("center", "cross", 768, 512),
];
const nativePath = `${root}world-atlas-v2-native.png`;
await sharp(base).composite(overlays).removeAlpha().withIccProfile("srgb")
  .png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(nativePath);

// Resize the continuous image ONCE, then crop. Independent tile resizing
// would sample the edges differently and introduce a visible export seam.
const masterPath = `${root}world-atlas-v2-master-7680x5120.png`;
await sharp(nativePath).resize(full.width, full.height, { kernel: "lanczos3" })
  .withIccProfile("srgb").png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(masterPath);

for (const quarter of quarters) {
  const rect = { left: quarter.column * tile.width, top: quarter.row * tile.height, ...tile };
  const filename = `world-atlas-v2-${quarter.id}-4k.png`;
  await sharp(masterPath).extract(rect).withIccProfile("srgb")
    .png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(`${runtime}${filename}`);
  quarter.path = `/assets/world/atlas-v2/${filename}`;
  quarter.rectangle = rect;
}

await sharp(nativePath).resize(1920, 1280).jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
  .toFile(`${root}world-atlas-v2-preview.jpg`);

// The existing /map canvas uses one image with percentage-based pins. Keep
// its browser copy at the composition's native resolution to avoid shipping
// the much larger upscaled PNG master to the image optimizer.
await sharp(nativePath).withIccProfile("srgb").webp({ quality: 92, effort: 6 })
  .toFile(`${runtime}world-atlas-v2.webp`);

await writeFile(`${runtime}manifest.json`, `${JSON.stringify({
  version: 2,
  aspectRatio: "3:2",
  nativeComposition: native,
  generatedQuarter: { width: 1536, height: 1024 },
  fullAtlas: full,
  tile,
  native4k: false,
  exportScale: 2.5,
  runtimeOverview: {
    path: "/assets/world/atlas-v2/world-atlas-v2.webp",
    ...native,
    format: "webp",
  },
  exportMethod: "Shared 3072x2048 composition with generated seam repairs; Lanczos3 resample once to 7680x5120; four exact non-overlapping crops.",
  origin: "top-left",
  order: ["top-left", "top-right", "bottom-left", "bottom-right"],
  gap: 0,
  overlap: 0,
  quarters,
}, null, 2)}\n`);
console.log("Exported four 3840x2560 PNG tiles, the 7680x5120 master, native composition, browser WebP, preview and placement manifest.");
