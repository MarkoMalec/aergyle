import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  ATLAS_EQUIPMENT,
  atlasItemCreateData,
  atlasSpritePath,
} from "../prisma/content/atlasEquipment";

const mode = process.argv[2] ?? "--check";
if (
  !["--check", "--apply", "--verify"].includes(mode) ||
  process.argv.length > 3
) {
  throw new Error("Usage: npm run db:seed:atlas -- [--check|--apply|--verify]");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function main() {
  // Art must exist before any templates are inserted.
  for (const item of ATLAS_EQUIPMENT) {
    const png = await readFile(
      new URL(`../public${atlasSpritePath(item)}`, import.meta.url),
    );
    if (
      png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== 256 ||
      png.readUInt32BE(20) !== 256 ||
      png[25] !== 6
    ) {
      throw new Error(`${item.slug}: expected a 256×256 RGBA PNG sprite`);
    }
  }

  const results = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.item.findMany({
        where: {
          OR: [
            { sprite: { in: ATLAS_EQUIPMENT.map(atlasSpritePath) } },
            { name: { in: ATLAS_EQUIPMENT.map((item) => item.name) } },
          ],
        },
        include: { stats: true },
      });
      const results: Array<{
        name: string;
        id: number | null;
        action: string;
      }> = [];
      for (const definition of ATLAS_EQUIPMENT) {
        const sprite = atlasSpritePath(definition);
        const matches = existing.filter(
          (item) => item.name === definition.name || item.sprite === sprite,
        );
        const found = matches[0];
        if (
          matches.length > 1 ||
          (found && (found.sprite !== sprite || found.name !== definition.name))
        ) {
          throw new Error(
            `Conflicting existing item for ${definition.name}; nothing was imported.`,
          );
        }
        if (mode === "--verify") {
          if (!found) throw new Error(`Missing item: ${definition.name}`);
          const expected = atlasItemCreateData(definition);
          for (const key of [
            "description",
            "price",
            "rarity",
            "itemType",
            "equipTo",
            "requiredLevel",
            "stackable",
            "maxStackSize",
            "minPhysicalDamage",
            "maxPhysicalDamage",
            "minMagicDamage",
            "maxMagicDamage",
            "armor",
          ] as const) {
            if (found[key] !== expected[key])
              throw new Error(`${definition.name}: ${key} differs`);
          }
          if (
            found.stats.length !== Object.keys(definition.stats).length ||
            found.stats.some(
              (stat) => definition.stats[stat.statType] !== stat.value,
            )
          ) {
            throw new Error(`${definition.name}: base stats differ`);
          }
        }
        if (found) {
          results.push({
            name: found.name,
            id: found.id,
            action: mode === "--verify" ? "verified" : "kept",
          });
        } else if (mode === "--apply") {
          const created = await tx.item.create({
            data: atlasItemCreateData(definition),
          });
          results.push({
            name: created.name,
            id: created.id,
            action: "created",
          });
        } else {
          results.push({
            name: definition.name,
            id: null,
            action: "would create",
          });
        }
      }
      return results;
    },
    { isolationLevel: "Serializable", timeout: 30_000 },
  );

  console.table(results);
  console.log(
    `${results.length} items. Mode: ${mode}. Existing items and player inventories are never overwritten.`,
  );
}

try {
  await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
