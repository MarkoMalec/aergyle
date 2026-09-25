import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  BAIT_ITEMS,
  baitItemCreateData,
  baitSpritePath,
} from "../prisma/content/baits";
import { changedFields } from "./seedHelpers";

const MODES = ["--check", "--apply", "--verify"] as const;
type Mode = (typeof MODES)[number];

const mode = process.argv[2] ?? "--check";
if (!MODES.includes(mode as Mode) || process.argv.length > 3) {
  throw new Error("Usage: npm run db:seed:baits -- [--check|--apply|--verify]");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function validateContent() {
  if (BAIT_ITEMS.length !== 15) {
    throw new Error("Bait content must contain exactly fifteen items");
  }

  const expectedLevels = [
    1, 8, 16, 28, 42, 58, 76, 98, 122, 150, 185, 225, 270, 325, 500,
  ];
  if (
    BAIT_ITEMS.some(
      (item, index) => item.requiredLevel !== expectedLevels[index],
    )
  ) {
    throw new Error("Bait levels must follow the authored 1–500 progression");
  }

  for (const field of ["slug", "name"] as const) {
    const values = BAIT_ITEMS.map((item) => item[field]);
    if (new Set(values).size !== values.length) {
      throw new Error(`Bait ${field}s must be unique`);
    }
  }

  for (const item of BAIT_ITEMS) {
    if (item.itemType !== "BAIT") {
      throw new Error(`${item.name} must use the BAIT item type`);
    }
    const png = await readFile(
      new URL(`../public${baitSpritePath(item)}`, import.meta.url),
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
}

async function main(selectedMode: Mode) {
  await validateContent();
  const names = BAIT_ITEMS.map((item) => item.name);
  const sprites = BAIT_ITEMS.map(baitSpritePath);

  const results = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.item.findMany({
        where: {
          OR: [{ name: { in: names } }, { sprite: { in: sprites } }],
        },
      });
      const rows: Array<{ name: string; action: string }> = [];

      for (const definition of BAIT_ITEMS) {
        const sprite = baitSpritePath(definition);
        const matches = existing.filter(
          (item) => item.name === definition.name || item.sprite === sprite,
        );
        const found = matches[0];
        if (
          matches.length > 1 ||
          (found && (found.name !== definition.name || found.sprite !== sprite))
        ) {
          throw new Error(
            `Conflicting existing item for ${definition.name}; no baits were imported.`,
          );
        }

        const expected = baitItemCreateData(definition);
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : [];

        if (selectedMode === "--verify") {
          if (!found) throw new Error(`Missing bait item: ${definition.name}`);
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
    `${results.length} bait items. Mode: ${selectedMode}. Existing player inventories are never changed.`,
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
