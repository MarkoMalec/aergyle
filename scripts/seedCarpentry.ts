import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  CARPENTRY_PLANKS,
  carpentryPlankItemCreateData,
  carpentryRequirementsForPlank,
} from "../prisma/content/carpentry";
import { changedFields, sameRequirements } from "./seedHelpers";

type Mode = "--check" | "--apply" | "--verify";

const mode = process.argv[2] ?? "--check";
if (
  !(mode === "--check" || mode === "--apply" || mode === "--verify") ||
  process.argv.length > 3
) {
  throw new Error(
    "Usage: npm run db:seed:carpentry -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function validateDefinitions() {
  if (CARPENTRY_PLANKS.length !== 8) {
    throw new Error("Carpentry must define one plank for each of eight logs");
  }
  if (
    new Set(CARPENTRY_PLANKS.map((plank) => plank.name)).size !==
      CARPENTRY_PLANKS.length ||
    new Set(CARPENTRY_PLANKS.map((plank) => plank.slug)).size !==
      CARPENTRY_PLANKS.length ||
    new Set(CARPENTRY_PLANKS.map((plank) => plank.sprite)).size !==
      CARPENTRY_PLANKS.length ||
    new Set(CARPENTRY_PLANKS.map((plank) => plank.sourceLogName)).size !==
      CARPENTRY_PLANKS.length
  ) {
    throw new Error(
      "Carpentry plank names, slugs, sprites and logs must be unique",
    );
  }

  for (const plank of CARPENTRY_PLANKS) {
    const png = await readFile(
      new URL(`../public${plank.sprite}`, import.meta.url),
    );
    if (
      png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== 256 ||
      png.readUInt32BE(20) !== 256 ||
      png[24] !== 8 ||
      png[25] !== 6
    ) {
      throw new Error(`${plank.sprite}: expected a 256x256 RGBA PNG sprite`);
    }
  }
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const notes: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const sourceLogNames = CARPENTRY_PLANKS.map(
        (plank) => plank.sourceLogName,
      );
      const sourceLogs = await tx.item.findMany({
        where: { name: { in: sourceLogNames } },
        select: {
          id: true,
          name: true,
          itemType: true,
          rarity: true,
          price: true,
        },
      });
      const logsByName = new Map<string, (typeof sourceLogs)[number]>();

      for (const plank of CARPENTRY_PLANKS) {
        const matches = sourceLogs.filter(
          (item) => item.name === plank.sourceLogName,
        );
        if (matches.length !== 1 || matches[0]?.itemType !== "LOG") {
          throw new Error(
            `${plank.sourceLogName}: expected exactly one existing LOG item; seed logs before Carpentry`,
          );
        }
        const log = matches[0];
        if (log.rarity !== plank.rarity) {
          throw new Error(
            `${plank.name}: rarity must match ${plank.sourceLogName}`,
          );
        }
        if (plank.price <= log.price) {
          throw new Error(
            `${plank.name}: price must exceed its source log value`,
          );
        }
        logsByName.set(log.name, log);
      }

      const plankNames = CARPENTRY_PLANKS.map((plank) => plank.name);
      const plankSprites = CARPENTRY_PLANKS.map((plank) => plank.sprite);
      const existingItems = await tx.item.findMany({
        where: {
          OR: [{ name: { in: plankNames } }, { sprite: { in: plankSprites } }],
        },
      });
      const plankItemIds = new Map<string, number>();

      for (const definition of CARPENTRY_PLANKS) {
        const matches = existingItems.filter(
          (item) =>
            item.name === definition.name || item.sprite === definition.sprite,
        );
        const found = matches[0] ?? null;
        if (
          matches.length > 1 ||
          (found &&
            (found.name !== definition.name ||
              found.sprite !== definition.sprite))
        ) {
          throw new Error(`Conflicting item template for ${definition.name}`);
        }

        const expected = carpentryPlankItemCreateData(definition);
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : Object.keys(expected);

        if (selectedMode === "--verify" && (!found || differences.length > 0)) {
          throw new Error(
            `${definition.name}: item differs (${differences.join(", ") || "missing"})`,
          );
        }

        let itemId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const written = found
            ? await tx.item.update({
                where: { id: found.id },
                data: expected,
              })
            : await tx.item.create({ data: expected });
          itemId = written.id;
        }
        if (itemId) plankItemIds.set(definition.name, itemId);

        notes.push(
          `${definition.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : found && differences.length === 0 ? "ready" : "would write"}`,
        );
      }

      const skillDescription =
        "Shape timber into planks, handles, shafts, bows and practical wooden items.";
      const existingSkill = await tx.skills.findUnique({
        where: { skill_name: "Carpentry" },
      });
      if (
        selectedMode === "--verify" &&
        (!existingSkill ||
          existingSkill.description !== skillDescription ||
          existingSkill.category !== "CRAFTING")
      ) {
        throw new Error("Carpentry skill is missing or differs");
      }
      if (selectedMode === "--apply") {
        await tx.skills.upsert({
          where: { skill_name: "Carpentry" },
          create: {
            skill_name: "Carpentry",
            description: skillDescription,
            category: "CRAFTING",
          },
          update: { description: skillDescription, category: "CRAFTING" },
        });
      }
      notes.push(
        `Carpentry skill: ${existingSkill ? "present" : "would create"}`,
      );

      const locations = await tx.location.findMany({
        select: { id: true, name: true },
        orderBy: [{ id: "asc" }],
      });
      if (locations.length === 0) {
        throw new Error(
          "At least one location is required before seeding Carpentry",
        );
      }

      for (const definition of CARPENTRY_PLANKS) {
        const outputItemId = plankItemIds.get(definition.name);
        const sourceLog = logsByName.get(definition.sourceLogName)!;
        const requirements = carpentryRequirementsForPlank(definition);
        const requirementRows = requirements.map((requirement) => ({
          itemId: sourceLog.id,
          quantityPerUnit: requirement.quantityPerUnit,
        }));

        if (!outputItemId) {
          if (selectedMode === "--check") {
            notes.push(`${definition.name}: would configure Carpentry recipe`);
            continue;
          }
          throw new Error(`${definition.name}: missing output item`);
        }

        const expectedResource = {
          actionType: "CARPENTRY" as const,
          name: definition.name,
          itemId: outputItemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: definition.requiredSkillLevel,
          defaultSeconds: definition.defaultSeconds,
          yieldPerUnit: definition.yieldPerUnit,
          xpPerUnit: definition.xpPerUnit,
          rarity: definition.rarity,
        };
        const found = await tx.vocationalResource.findUnique({
          where: { itemId: outputItemId },
          include: {
            requirements: {
              select: { itemId: true, quantityPerUnit: true },
            },
            locations: { select: { locationId: true, enabled: true } },
          },
        });
        if (found && found.actionType !== "CARPENTRY") {
          throw new Error(
            `${definition.name} already belongs to ${found.actionType}`,
          );
        }

        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expectedResource as unknown as Record<string, unknown>,
            )
          : Object.keys(expectedResource);
        const requirementsMatch = sameRequirements(
          found?.requirements ?? [],
          requirementRows,
        );
        const enabledLocations = new Set(
          found?.locations
            .filter((location) => location.enabled)
            .map((location) => location.locationId) ?? [],
        );
        const locationsMatch =
          enabledLocations.size === locations.length &&
          locations.every((location) => enabledLocations.has(location.id));

        if (
          selectedMode === "--verify" &&
          (!found ||
            differences.length > 0 ||
            !requirementsMatch ||
            !locationsMatch)
        ) {
          throw new Error(`${definition.name}: Carpentry recipe differs`);
        }

        if (selectedMode === "--apply") {
          const resource = await tx.vocationalResource.upsert({
            where: { itemId: outputItemId },
            create: expectedResource,
            update: expectedResource,
          });
          await tx.vocationalRequirement.deleteMany({
            where: { resourceId: resource.id },
          });
          await tx.vocationalRequirement.createMany({
            data: requirementRows.map((requirement) => ({
              resourceId: resource.id,
              ...requirement,
            })),
          });
          for (const location of locations) {
            await tx.locationVocationalResource.upsert({
              where: {
                locationId_resourceId: {
                  locationId: location.id,
                  resourceId: resource.id,
                },
              },
              create: {
                locationId: location.id,
                resourceId: resource.id,
                enabled: true,
              },
              update: { enabled: true },
            });
          }
        }
        notes.push(`${definition.name}: Carpentry recipe configured`);
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${mode.slice(2)} complete: ${CARPENTRY_PLANKS.length} plank items and one-log Carpentry recipes.`,
  );
}

try {
  await main(mode as Mode);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
