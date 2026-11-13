import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ENCHANTING_MATERIALS,
  enchantingMaterialCreateData,
  enchantingMaterialSpritePath,
} from "../prisma/content/enchantingMaterials";
import { changedFields } from "./seedHelpers";

const MODES = ["--check", "--apply", "--verify"] as const;
type Mode = (typeof MODES)[number];

const mode = process.argv[2] ?? "--check";
if (!MODES.includes(mode as Mode) || process.argv.length > 3) {
  throw new Error(
    "Usage: npm run db:seed:enchanting-materials -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function validateContent() {
  if (ENCHANTING_MATERIALS.length !== 1) {
    throw new Error(
      "Enchanting materials must contain exactly Celestial Stone",
    );
  }

  for (const key of ["slug", "name"] as const) {
    const values = ENCHANTING_MATERIALS.map((item) => item[key]);
    if (new Set(values).size !== values.length) {
      throw new Error(`Enchanting material ${key}s must be unique`);
    }
  }

  for (const item of ENCHANTING_MATERIALS) {
    if (item.itemType !== "MATERIAL" || !item.rarity || item.price < 0) {
      throw new Error(`${item.name}: invalid material definition`);
    }
    const sprite = enchantingMaterialSpritePath(item);
    const png = await readFile(new URL(`../public${sprite}`, import.meta.url));
    if (
      png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== 256 ||
      png.readUInt32BE(20) !== 256 ||
      png[24] !== 8 ||
      png[25] !== 6
    ) {
      throw new Error(`${sprite}: expected a 256×256 RGBA PNG sprite`);
    }
  }
}

async function main(selectedMode: Mode) {
  await validateContent();
  const names = ENCHANTING_MATERIALS.map((item) => item.name);
  const sprites = ENCHANTING_MATERIALS.map(enchantingMaterialSpritePath);

  const results = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.item.findMany({
        where: { OR: [{ name: { in: names } }, { sprite: { in: sprites } }] },
      });
      const rows: Array<{ name: string; action: string }> = [];

      for (const definition of ENCHANTING_MATERIALS) {
        const sprite = enchantingMaterialSpritePath(definition);
        const matches = existing.filter(
          (item) => item.name === definition.name || item.sprite === sprite,
        );
        const found = matches[0];
        if (
          matches.length > 1 ||
          (found && (found.name !== definition.name || found.sprite !== sprite))
        ) {
          throw new Error(
            `Conflicting existing item for ${definition.name}; no enchanting materials were imported.`,
          );
        }

        const expected = enchantingMaterialCreateData(definition);
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : [];

        if (selectedMode === "--verify") {
          if (!found)
            throw new Error(`Missing enchanting material: ${definition.name}`);
          if (differences.length > 0) {
            throw new Error(
              `${definition.name}: item fields differ (${differences.join(", ")})`,
            );
          }
        }

        if (!found && selectedMode === "--apply") {
          await tx.item.create({ data: expected });
          rows.push({ name: definition.name, action: "created" });
        } else if (
          found &&
          differences.length > 0 &&
          selectedMode === "--apply"
        ) {
          await tx.item.update({ where: { id: found.id }, data: expected });
          rows.push({ name: definition.name, action: "updated" });
        } else {
          rows.push({
            name: definition.name,
            action:
              selectedMode === "--verify"
                ? "verified"
                : found
                  ? differences.length > 0
                    ? "would update"
                    : "kept"
                  : "would create",
          });
        }
      }

      return rows;
    },
    { isolationLevel: "Serializable", maxWait: 30_000, timeout: 30_000 },
  );

  console.table(results);
  console.log(
    `${results.length} enchanting materials. Mode: ${selectedMode}. Existing player inventories are never changed.`,
  );
}

void main(mode as Mode)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
