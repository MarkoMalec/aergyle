import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  HUNTING_CREATURES,
  HUNTING_DURATIONS,
  HUNTING_GROUNDS,
  HUNTING_ITEMS,
  huntingItemData,
} from "../prisma/content/hunting";
import { changedFields } from "./seedHelpers";

type Mode = "--check" | "--apply" | "--verify";
const mode = (process.argv[2] ?? "--check") as Mode;
if (!["--check", "--apply", "--verify"].includes(mode)) {
  throw new Error(
    "Usage: npm run db:seed:hunting -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function assertRgbaSprite(sprite: string) {
  const png = await readFile(new URL(`../public${sprite}`, import.meta.url));
  if (
    png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
    png.readUInt32BE(16) !== 256 ||
    png.readUInt32BE(20) !== 256 ||
    png[25] !== 6
  ) {
    throw new Error(`${sprite}: expected a 256×256 RGBA PNG asset`);
  }
}

async function validateContent() {
  if (
    new Set(HUNTING_ITEMS.map((item) => item.name)).size !==
    HUNTING_ITEMS.length
  ) {
    throw new Error("Hunting item names must be unique");
  }
  if (
    new Set(HUNTING_CREATURES.map((creature) => creature.name)).size !==
    HUNTING_CREATURES.length
  ) {
    throw new Error("Hunting creature names must be unique");
  }

  const itemNames = new Set(HUNTING_ITEMS.map((item) => item.name));
  const creatureNames = new Set(
    HUNTING_CREATURES.map((creature) => creature.name),
  );
  for (const item of HUNTING_ITEMS) await assertRgbaSprite(item.sprite);
  for (const creature of HUNTING_CREATURES) {
    await assertRgbaSprite(creature.asset);
    if (
      creature.attackChance < 0 ||
      creature.attackChance > 1 ||
      creature.damageMin < 0 ||
      creature.damageMax < creature.damageMin ||
      Number(creature.drops.length) === 0
    ) {
      throw new Error(`${creature.name}: invalid danger or empty drop table`);
    }
    for (const drop of creature.drops) {
      if (!itemNames.has(drop.itemName as never)) {
        throw new Error(`${creature.name}: unknown drop ${drop.itemName}`);
      }
      if (
        drop.baseChance <= 0 ||
        drop.baseChance > 1 ||
        drop.minQuantity < 1 ||
        drop.maxQuantity < drop.minQuantity
      ) {
        throw new Error(
          `${creature.name}/${drop.itemName}: invalid drop balance`,
        );
      }
    }
  }
  for (const ground of HUNTING_GROUNDS) {
    if (Number(ground.creatures.length) === 0) {
      throw new Error(
        `${ground.locationName}/${ground.name}: empty animal list`,
      );
    }
    for (const creature of ground.creatures) {
      if (
        !creatureNames.has(creature.name as never) ||
        creature.encounterWeight <= 0
      ) {
        throw new Error(`${ground.name}: invalid animal ${creature.name}`);
      }
    }
  }
}

async function main(selectedMode: Mode) {
  await validateContent();
  const notes: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const itemIds = new Map<string, number>();
      const existingItems = await tx.item.findMany({
        where: {
          OR: [
            { name: { in: HUNTING_ITEMS.map((item) => item.name) } },
            { sprite: { in: HUNTING_ITEMS.map((item) => item.sprite) } },
          ],
        },
      });
      for (const definition of HUNTING_ITEMS) {
        const expected = huntingItemData(definition);
        const matches = existingItems.filter(
          (item) =>
            item.name === definition.name || item.sprite === definition.sprite,
        );
        if (new Set(matches.map((item) => item.id)).size > 1) {
          throw new Error(`Conflicting item template for ${definition.name}`);
        }
        const found = matches[0] ?? null;
        const diff = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(
            `${definition.name}: item differs (${diff.join(", ")})`,
          );
        }

        let id = found?.id ?? null;
        if (selectedMode === "--apply") {
          const item = found
            ? await tx.item.update({ where: { id: found.id }, data: expected })
            : await tx.item.create({ data: expected });
          id = item.id;
        }
        if (id) itemIds.set(definition.name, id);
        notes.push(
          `${definition.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : found && diff.length === 0 ? "ready" : "would write"}`,
        );
      }

      const creatureIds = new Map<string, number>();
      for (const definition of HUNTING_CREATURES) {
        const expected = {
          name: definition.name,
          description: definition.description,
          kind: "ANIMAL" as const,
          asset: definition.asset,
          enabled: true,
          attackStyle: definition.attackStyle,
          attackChance: definition.attackChance,
          damageMin: definition.damageMin,
          damageMax: definition.damageMax,
        };
        const found = await tx.creature.findUnique({
          where: { name: definition.name },
        });
        const diff = found
          ? changedFields(found as unknown as Record<string, unknown>, expected)
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(
            `${definition.name}: creature differs (${diff.join(", ")})`,
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
        if (creatureId) creatureIds.set(definition.name, creatureId);

        if (!creatureId) continue;
        for (const drop of definition.drops) {
          const itemId = itemIds.get(drop.itemName);
          if (!itemId) {
            if (selectedMode === "--check") continue;
            throw new Error(`Missing drop item ${drop.itemName}`);
          }
          const expectedDrop = {
            enabled: true,
            baseChance: drop.baseChance,
            minQuantity: drop.minQuantity,
            maxQuantity: drop.maxQuantity,
            requiredLevel: drop.requiredHuntingLevel,
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
          name: { in: HUNTING_GROUNDS.map((ground) => ground.locationName) },
        },
        select: { id: true, name: true },
      });
      const locationByName = new Map(
        locations.map((location) => [location.name, location.id]),
      );
      for (const ground of HUNTING_GROUNDS) {
        const locationId = locationByName.get(ground.locationName);
        if (!locationId)
          throw new Error(
            `Existing location not found: ${ground.locationName}`,
          );
        const expected = {
          description: ground.description,
          requiredHuntingLevel: ground.requiredHuntingLevel,
          enabled: true,
          sortOrder: ground.sortOrder,
          accidentChance: ground.accidentChance,
          accidentDamageMin: ground.accidentDamageMin,
          accidentDamageMax: ground.accidentDamageMax,
        };
        const found = await tx.huntingGround.findUnique({
          where: { locationId_name: { locationId, name: ground.name } },
        });
        const diff = found
          ? changedFields(found as unknown as Record<string, unknown>, expected)
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(
            `${ground.locationName}/${ground.name}: ground differs`,
          );
        }

        let groundId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const written = await tx.huntingGround.upsert({
            where: { locationId_name: { locationId, name: ground.name } },
            create: { locationId, name: ground.name, ...expected },
            update: expected,
          });
          groundId = written.id;
        }
        if (!groundId) continue;
        for (const assignment of ground.creatures) {
          const creatureId = creatureIds.get(assignment.name);
          if (!creatureId) {
            if (selectedMode === "--check") continue;
            throw new Error(`Missing creature ${assignment.name}`);
          }
          const expectedAssignment = {
            enabled: true,
            encounterWeight: assignment.encounterWeight,
          };
          const foundAssignment = await tx.huntingGroundCreature.findUnique({
            where: { groundId_creatureId: { groundId, creatureId } },
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
            throw new Error(
              `${ground.name}/${assignment.name}: assignment differs`,
            );
          }
          if (selectedMode === "--apply") {
            await tx.huntingGroundCreature.upsert({
              where: { groundId_creatureId: { groundId, creatureId } },
              create: { groundId, creatureId, ...expectedAssignment },
              update: expectedAssignment,
            });
          }
        }
      }

      for (const definition of HUNTING_DURATIONS) {
        const found = await tx.huntingDuration.findFirst({
          where: {
            OR: [
              { label: definition.label },
              { durationSeconds: definition.durationSeconds },
            ],
          },
        });
        const expected = { ...definition, enabled: true };
        const diff = found
          ? changedFields(found as unknown as Record<string, unknown>, expected)
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(`${definition.label}: duration differs`);
        }
        if (selectedMode === "--apply") {
          if (found) {
            await tx.huntingDuration.update({
              where: { id: found.id },
              data: expected,
            });
          } else {
            await tx.huntingDuration.create({ data: expected });
          }
        }
      }

      const skill = {
        skill_name: "Hunting",
        description:
          "Track animals through local hunting grounds and return with meat, hides, bones, and other materials.",
        category: "VOCATION" as const,
      };
      const foundSkill = await tx.skills.findUnique({
        where: { skill_name: skill.skill_name },
      });
      if (
        selectedMode === "--verify" &&
        (!foundSkill ||
          foundSkill.description !== skill.description ||
          foundSkill.category !== skill.category)
      ) {
        throw new Error("Hunting skill definition differs");
      }
      if (selectedMode === "--apply") {
        await tx.skills.upsert({
          where: { skill_name: skill.skill_name },
          create: skill,
          update: { description: skill.description, category: skill.category },
        });
        await tx.huntingConfig.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {},
        });

        const bow = await tx.item.findFirst({
          where: { name: "Reedwind Bow" },
          select: { id: true },
        });
        if (bow) {
          await tx.toolEfficiency.upsert({
            where: {
              itemId_actionType: { itemId: bow.id, actionType: "HUNTING" },
            },
            create: {
              itemId: bow.id,
              actionType: "HUNTING",
              baseEfficiency: 12,
            },
            update: { baseEfficiency: 12 },
          });
        }
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${selectedMode.slice(2)} complete: ${HUNTING_ITEMS.length} materials, ${HUNTING_CREATURES.length} animals, ${HUNTING_GROUNDS.length} grounds, ${HUNTING_DURATIONS.length} durations.`,
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
