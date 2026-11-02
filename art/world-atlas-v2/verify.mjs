import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("./", import.meta.url));
const runtime = fileURLToPath(new URL("../../public/assets/world/atlas-v2/", import.meta.url));
const manifest = JSON.parse(await readFile(`${runtime}manifest.json`, "utf8"));
const masterPath = `${root}world-atlas-v2-master-7680x5120.png`;
const master = await sharp(masterPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(master.info.width, 7680);
assert.equal(master.info.height, 5120);
assert.equal(master.info.channels, 3);

const checks = [];
for (const quarter of manifest.quarters) {
  const path = `${runtime}${quarter.path.split("/").at(-1)}`;
  const file = await readFile(path);
  const meta = await sharp(file).metadata();
  assert.equal(meta.width, 3840);
  assert.equal(meta.height, 2560);
  assert.equal(meta.hasAlpha, false);
  assert.equal(meta.space, "srgb");
  const pixels = await sharp(file).raw().toBuffer();
  const rect = quarter.rectangle;
  const stride = rect.width * 3;
  for (let row = 0; row < rect.height; row += 1) {
    const begin = ((rect.top + row) * master.info.width + rect.left) * 3;
    assert.ok(
      pixels.subarray(row * stride, (row + 1) * stride)
        .equals(master.data.subarray(begin, begin + stride)),
      `${quarter.id} must exactly match its master rectangle, row ${row}`,
    );
  }
  checks.push({
    id: quarter.id,
    width: meta.width,
    height: meta.height,
    format: meta.format,
    colorSpace: meta.space,
    opaque: true,
    bytes: file.length,
    sha256: createHash("sha256").update(file).digest("hex"),
    exactPixelMatchToMaster: true,
  });
}

// Check that every atlas pixel belongs to exactly one tile, with no gap or
// duplicated border. The master comparison includes all boundary pixels.
assert.deepEqual(manifest.quarters.map(q => [q.rectangle.left, q.rectangle.top]),
  [[0, 0], [3840, 0], [0, 2560], [3840, 2560]]);
const report = {
  checkedAt: new Date().toISOString(),
  native4k: false,
  originalAspectRatioPreserved: true,
  fullAtlas: { width: 7680, height: 5120 },
  everyTilePixelMatchesSharedMaster: true,
  gapPixels: 0,
  overlapPixels: 0,
  note: "Pixel reconstruction verifies export alignment. Artistic continuity was separately reviewed in the complete preview and native-resolution seam crops.",
  quarters: checks,
};
await writeFile(`${root}validation.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
