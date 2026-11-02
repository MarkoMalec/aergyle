import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
const bounds = {
  "top-left": { left: 0, top: 0, width: 768, height: 512 },
  "top-right": { left: 768, top: 0, width: 768, height: 512 },
  "bottom-left": { left: 0, top: 512, width: 768, height: 512 },
  "bottom-right": { left: 768, top: 512, width: 768, height: 512 },
  center: { left: 384, top: 256, width: 768, height: 512 },
};

await mkdir(`${root}guides`, { recursive: true });
for (const [name, rect] of Object.entries(bounds)) {
  await sharp(`${root}source/world-layout-master.png`)
    .extract(rect)
    .png()
    .toFile(`${root}guides/${name}.png`);
}
await writeFile(`${root}guides/bounds.json`, `${JSON.stringify(bounds, null, 2)}\n`);
console.log("Prepared four exact quadrant guides and a shared center guide.");
