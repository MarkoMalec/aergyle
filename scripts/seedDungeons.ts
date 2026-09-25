import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { DUNGEON_MONSTERS, DUNGEONS } from "../prisma/content/dungeons";
import { changedFields } from "./seedHelpers";

type Mode = "--check" | "--apply" | "--verify";
const mode = (process.argv[2] ?? "--check") as Mode;
if (!["--check", "--apply", "--verify"].includes(mode)) {
  throw new Error(
    "Usage: npm run db:seed:dungeons -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function validateContent() {
  const monsterNames = new Set(DUNGEON_MONSTERS.map((monster) => monster.name));
  if (monsterNames.size !== DUNGEON_MONSTERS.length) {
    throw new Error("Monster names must be unique");
  }
  for (const monster of DUNGEON_MONSTERS) {
    const png = await readFile(
      new URL(`../public${monster.asset}`, import.meta.url),
    );
    if (png.toString("hex", 0, 8) !== "89504e470d0a1a0a" || png[25] !== 6) {
      throw new Error(`${monster.asset}: expected an RGBA PNG asset`);
    }
    if (monster.health < 1 || monster.damageMax < monster.damageMin) {
      throw new Error(`${monster.name}: invalid combat profile`);
    }
  }
  for (const dungeon of DUNGEONS) {
    for (const monster of dungeon.monsters) {
      if (
        !monsterNames.has(monster.name) ||
        monster.minCount < 1 ||
        monster.maxCount < monster.minCount
      ) {
        throw new Error(`${dungeon.name}: invalid monster ${monster.name}`);
      }
    }
  }
}

async function main(selectedMode: Mode) {
  await validateContent();
  const notes: string[] = [];
  const note = (label: string, found: boolean, diff: string[]) =>
    notes.push(
      `${label}: ${
        selectedMode === "--apply"
          ? found
            ? "updated"
            : "created"
          : found && diff.length === 0
            ? "ready"
            : "would write"
      }`,
    );

  await prisma.$transaction(
    async (tx) => {
      const dropItemNames = [
        ...new Set(
          DUNGEON_MONSTERS.flatMap((monster) =>
            monster.drops.map((drop) => drop.itemName),
          ),
        ),
      ];
      const items = await tx.item.findMany({
        where: { name: { in: dropItemNames } },
        select: { id: true, name: true },
      });
      const itemIds = new Map(items.map((item) => [item.name, item.id]));
      const missingItems = dropItemNames.filter((name) => !itemIds.has(name));
      if (missingItems.length > 0) {
        throw new Error(
          `Missing loot items (run their content seeders first): ${missingItems.join(", ")}`,
        );
      }

      const creatureIds = new Map<string, number>();
      for (const { drops, ...definition } of DUNGEON_MONSTERS) {
        const expected = {
          ...definition,
          kind: "MONSTER" as const,
          enabled: true,
        };
        const found = await tx.creature.findUnique({
          where: { name: definition.name },
        });
        if (found && found.kind !== "MONSTER") {
          throw new Error(`${definition.name} already exists as an animal`);
        }
        const diff = found
          ? changedFields(found as unknown as Record<string, unknown>, expected)
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(
            `${definition.name}: monster differs (${diff.join(", ")})`,
          );
        }
        let creatureId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const creature = await tx.creature.upsert({
            where: { name: definition.name },
            create: expected,
            update: expected,
          });
          creatureId = creature.id;
        }
        note(definition.name, Boolean(found), diff);
        if (!creatureId) continue;
        creatureIds.set(definition.name, creatureId);

        for (const drop of drops) {
          const itemId = itemIds.get(drop.itemName)!;
          const expectedDrop = {
            enabled: true,
            baseChance: drop.baseChance,
            minQuantity: drop.minQuantity,
            maxQuantity: drop.maxQuantity,
            requiredLevel: drop.requiredLevel,
          };
          const foundDrop = await tx.creatureDrop.findUnique({
            where: { creatureId_itemId: { creatureId, itemId } },
          });
          const dropDiff = foundDrop
            ? changedFields(
                foundDrop as unknown as Record<string, unknown>,
                expectedDrop,
              )
            : Object.keys(expectedDrop);
          if (
            selectedMode === "--verify" &&
            (!foundDrop || dropDiff.length > 0)
          ) {
            throw new Error(
              `${definition.name}/${drop.itemName}: drop differs`,
            );
          }
          if (selectedMode === "--apply") {
            await tx.creatureDrop.upsert({
              where: { creatureId_itemId: { creatureId, itemId } },
              create: { creatureId, itemId, ...expectedDrop },
              update: expectedDrop,
            });
          }
        }
      }

      const locations = await tx.location.findMany({
        where: {
          name: {
            in: [
              ...new Set(
                DUNGEONS.flatMap((dungeon) => [
                  dungeon.locationName,
                  ...(dungeon.locationAliases ?? []),
                ]),
              ),
            ],
          },
        },
        select: { id: true, name: true },
      });
      const locationIds = new Map(
        locations.map((location) => [location.name, location.id]),
      );
      for (const {
        locationName,
        locationAliases = [],
        monsters,
        ...definition
      } of DUNGEONS) {
        const matchedLocationName = [locationName, ...locationAliases].find(
          (candidate) => locationIds.has(candidate),
        );
        const locationId = matchedLocationName
          ? locationIds.get(matchedLocationName)
          : null;
        if (!locationId) {
          const aliases = locationAliases.length
            ? ` (also accepted: ${locationAliases.join(", ")})`
            : "";
          throw new Error(
            `Existing location not found: ${locationName}${aliases}`,
          );
        }
        const { name, ...expected } = { ...definition, enabled: true };
        const where = { locationId_name: { locationId, name } };
        const found = await tx.dungeon.findUnique({ where });
        const diff = found
          ? changedFields(found as unknown as Record<string, unknown>, expected)
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(`${name}: dungeon differs (${diff.join(", ")})`);
        }
        let dungeonId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const dungeon = await tx.dungeon.upsert({
            where,
            create: { locationId, name, ...expected },
            update: expected,
          });
          dungeonId = dungeon.id;
        }
        note(`${matchedLocationName} · ${name}`, Boolean(found), diff);
        if (!dungeonId) continue;

        for (const monster of monsters) {
          const creatureId = creatureIds.get(monster.name);
          if (!creatureId) {
            if (selectedMode === "--check") continue;
            throw new Error(`Missing monster ${monster.name}`);
          }
          const expectedAssignment = {
            enabled: true,
            minCount: monster.minCount,
            maxCount: monster.maxCount,
          };
          const assignmentWhere = {
            dungeonId_creatureId: { dungeonId, creatureId },
          };
          const foundAssignment = await tx.dungeonMonster.findUnique({
            where: assignmentWhere,
          });
          const assignmentDiff = foundAssignment
            ? changedFields(
                foundAssignment as unknown as Record<string, unknown>,
                expectedAssignment,
              )
            : Object.keys(expectedAssignment);
          if (
            selectedMode === "--verify" &&
            (!foundAssignment || assignmentDiff.length > 0)
          ) {
            throw new Error(`${name}/${monster.name}: population differs`);
          }
          if (selectedMode === "--apply") {
            await tx.dungeonMonster.upsert({
              where: assignmentWhere,
              create: { dungeonId, creatureId, ...expectedAssignment },
              update: expectedAssignment,
            });
          }
        }
      }

      if (selectedMode === "--apply") {
        await tx.dungeonConfig.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {},
        });
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${selectedMode.slice(2)} complete: ${DUNGEON_MONSTERS.length} monsters, ${DUNGEONS.length} dungeons.`,
  );
}

async function run() {
  try {
    await main(mode);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
