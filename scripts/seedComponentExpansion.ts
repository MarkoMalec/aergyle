import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  BASIC_PICKAXE_REQUIREMENTS,
  COMPONENT_CRAFTS,
  COMPONENT_GATHERING_SOURCES,
  COMPONENT_ITEMS,
  componentItemCreateData,
} from "../prisma/content/componentExpansion";

type Mode = "--check" | "--apply" | "--verify";

const mode = process.argv[2] ?? "--check";
if (
  !(mode === "--check" || mode === "--apply" || mode === "--verify") ||
  process.argv.length > 3
) {
  throw new Error(
    "Usage: npm run db:seed:components -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

function changedFields(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
) {
  return Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key]) => key);
}

function sameRequirements(
  actual: ReadonlyArray<{ itemId: number; quantityPerUnit: number }>,
  expected: ReadonlyArray<{ itemId: number; quantityPerUnit: number }>,
) {
  const quantities = new Map(
    actual.map((requirement) => [
      requirement.itemId,
      requirement.quantityPerUnit,
    ]),
  );
  return (
    quantities.size === expected.length &&
    expected.every(
      (requirement) =>
        quantities.get(requirement.itemId) === requirement.quantityPerUnit,
    )
  );
}

async function validateDefinitions() {
  if (COMPONENT_ITEMS.length !== 5 || COMPONENT_CRAFTS.length !== 3) {
    throw new Error(
      "Component expansion must define five items and three crafts",
    );
  }

  for (const key of ["name", "slug", "sprite"] as const) {
    if (
      new Set(COMPONENT_ITEMS.map((item) => item[key])).size !==
      COMPONENT_ITEMS.length
    ) {
      throw new Error(`Component item ${key}s must be unique`);
    }
  }

  const itemNames = new Set(COMPONENT_ITEMS.map((item) => item.name));
  if (
    COMPONENT_CRAFTS.some((craft) => !itemNames.has(craft.outputItemName)) ||
    new Set(COMPONENT_CRAFTS.map((craft) => craft.outputItemName)).size !==
      COMPONENT_CRAFTS.length
  ) {
    throw new Error("Every component craft needs one unique component output");
  }

  for (const item of COMPONENT_ITEMS) {
    const png = await readFile(
      new URL(`../public${item.sprite}`, import.meta.url),
    );
    if (
      png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== 256 ||
      png.readUInt32BE(20) !== 256 ||
      png[24] !== 8 ||
      png[25] !== 6
    ) {
      throw new Error(`${item.sprite}: expected a 256x256 RGBA PNG sprite`);
    }
  }
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const notes: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const expectedDependencyTypes = new Map([
        ["Oak Plank", "MATERIAL"],
        ["Elderwood Plank", "MATERIAL"],
        ["Soft Hide", "HIDE"],
        ["Iron Ingot", "INGOT"],
        ["Basic Pickaxe", "PICKAXE"],
      ] as const);
      const dependencyItems = await tx.item.findMany({
        where: { name: { in: [...expectedDependencyTypes.keys()] } },
        select: { id: true, name: true, itemType: true },
      });
      const itemIds = new Map<string, number>();

      for (const [name, itemType] of expectedDependencyTypes) {
        const matches = dependencyItems.filter((item) => item.name === name);
        if (matches.length !== 1 || matches[0]?.itemType !== itemType) {
          throw new Error(
            `${name}: expected exactly one existing ${itemType} item`,
          );
        }
        itemIds.set(name, matches[0].id);
      }

      const itemNames = COMPONENT_ITEMS.map((item) => item.name);
      const itemSprites = COMPONENT_ITEMS.map((item) => item.sprite);
      const existingItems = await tx.item.findMany({
        where: {
          OR: [{ name: { in: itemNames } }, { sprite: { in: itemSprites } }],
        },
      });

      for (const definition of COMPONENT_ITEMS) {
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

        const expected = componentItemCreateData(definition);
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
            ? await tx.item.update({ where: { id: found.id }, data: expected })
            : await tx.item.create({ data: expected });
          itemId = written.id;
        }
        if (itemId) itemIds.set(definition.name, itemId);

        notes.push(
          `${definition.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : found && differences.length === 0 ? "ready" : "would write"}`,
        );
      }

      const locations = await tx.location.findMany({
        select: { id: true, name: true },
        orderBy: [{ id: "asc" }],
      });
      if (locations.length === 0) {
        throw new Error("At least one location is required for crafting");
      }
      const locationsByName = new Map(
        locations.map((location) => [location.name, location]),
      );

      for (const source of COMPONENT_GATHERING_SOURCES) {
        const itemId = itemIds.get(source.itemName);
        const item = COMPONENT_ITEMS.find(
          (definition) => definition.name === source.itemName,
        );
        for (const location of source.locations) {
          if (!locationsByName.has(location.locationName)) {
            throw new Error(
              `Existing location not found: ${location.locationName}`,
            );
          }
        }
        if (!itemId || !item) {
          if (selectedMode === "--check") {
            notes.push(`${source.itemName}: would configure Gathering source`);
            continue;
          }
          throw new Error(`${source.itemName}: missing Gathering item`);
        }

        const expectedResource = {
          actionType: "GATHERING" as const,
          name: source.itemName,
          itemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: source.requiredSkillLevel,
          defaultSeconds: 3_600,
          yieldPerUnit: 1,
          xpPerUnit: 0,
          rarity: item.rarity,
        };
        const found = await tx.vocationalResource.findUnique({
          where: { itemId },
        });
        if (found && found.actionType !== "GATHERING") {
          throw new Error(
            `${source.itemName} already belongs to ${found.actionType}`,
          );
        }
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expectedResource as unknown as Record<string, unknown>,
            )
          : Object.keys(expectedResource);
        if (selectedMode === "--verify" && (!found || differences.length > 0)) {
          throw new Error(`${source.itemName}: Gathering resource differs`);
        }

        let resourceId = found?.id ?? null;
        if (selectedMode === "--apply") {
          resourceId = (
            await tx.vocationalResource.upsert({
              where: { itemId },
              create: expectedResource,
              update: expectedResource,
            })
          ).id;
        }
        if (!resourceId) continue;

        for (const location of source.locations) {
          const locationId = locationsByName.get(location.locationName)!.id;
          const expectedJoin = {
            enabled: true,
            gatheringBaseChance: location.baseChance,
            gatheringMinQuantity: location.minQuantity,
            gatheringMaxQuantity: location.maxQuantity,
          };
          const foundJoin = await tx.locationVocationalResource.findUnique({
            where: { locationId_resourceId: { locationId, resourceId } },
          });
          const joinDifferences = foundJoin
            ? changedFields(
                foundJoin as unknown as Record<string, unknown>,
                expectedJoin,
              )
            : Object.keys(expectedJoin);
          if (
            selectedMode === "--verify" &&
            (!foundJoin || joinDifferences.length > 0)
          ) {
            throw new Error(
              `${location.locationName}/${source.itemName}: Gathering pool differs`,
            );
          }
          if (selectedMode === "--apply") {
            await tx.locationVocationalResource.upsert({
              where: { locationId_resourceId: { locationId, resourceId } },
              create: { locationId, resourceId, ...expectedJoin },
              update: expectedJoin,
            });
          }
        }
        notes.push(`${source.itemName}: Gathering source configured`);
      }

      for (const craft of COMPONENT_CRAFTS) {
        const outputItemId = itemIds.get(craft.outputItemName);
        const outputItem = COMPONENT_ITEMS.find(
          (definition) => definition.name === craft.outputItemName,
        );
        const requirementRows = craft.requirements.flatMap((requirement) => {
          const itemId = itemIds.get(requirement.itemName);
          return itemId
            ? [{ itemId, quantityPerUnit: requirement.quantityPerUnit }]
            : [];
        });
        if (
          !outputItemId ||
          !outputItem ||
          requirementRows.length !== craft.requirements.length
        ) {
          if (selectedMode === "--check") {
            notes.push(`${craft.outputItemName}: would configure craft`);
            continue;
          }
          throw new Error(
            `${craft.outputItemName}: missing output or ingredient`,
          );
        }

        const expectedResource = {
          actionType: craft.actionType,
          name: craft.outputItemName,
          itemId: outputItemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: craft.requiredSkillLevel,
          defaultSeconds: craft.defaultSeconds,
          yieldPerUnit: craft.yieldPerUnit,
          xpPerUnit: craft.xpPerUnit,
          rarity: outputItem.rarity,
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
        if (found && found.actionType !== craft.actionType) {
          throw new Error(
            `${craft.outputItemName} already belongs to ${found.actionType}`,
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
          throw new Error(`${craft.outputItemName}: crafting recipe differs`);
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
        notes.push(
          `${craft.outputItemName}: ${craft.actionType} recipe configured`,
        );
      }

      const pickaxeItemId = itemIds.get("Basic Pickaxe")!;
      const pickaxeResource = await tx.vocationalResource.findUnique({
        where: { itemId: pickaxeItemId },
        include: {
          requirements: {
            select: { itemId: true, quantityPerUnit: true },
          },
        },
      });
      if (!pickaxeResource || pickaxeResource.actionType !== "BLACKSMITHING") {
        throw new Error(
          "Basic Pickaxe must have an existing Blacksmithing recipe",
        );
      }
      const pickaxeRequirementRows = BASIC_PICKAXE_REQUIREMENTS.flatMap(
        (requirement) => {
          const itemId = itemIds.get(requirement.itemName);
          return itemId
            ? [{ itemId, quantityPerUnit: requirement.quantityPerUnit }]
            : [];
        },
      );
      const pickaxeMatches =
        pickaxeRequirementRows.length === BASIC_PICKAXE_REQUIREMENTS.length &&
        sameRequirements(pickaxeResource.requirements, pickaxeRequirementRows);
      if (selectedMode === "--verify" && !pickaxeMatches) {
        throw new Error("Basic Pickaxe requirements differ");
      }
      if (selectedMode === "--apply") {
        if (
          pickaxeRequirementRows.length !== BASIC_PICKAXE_REQUIREMENTS.length
        ) {
          throw new Error(
            "Basic Pickaxe is missing a required ingredient item",
          );
        }
        await tx.vocationalRequirement.deleteMany({
          where: { resourceId: pickaxeResource.id },
        });
        await tx.vocationalRequirement.createMany({
          data: pickaxeRequirementRows.map((requirement) => ({
            resourceId: pickaxeResource.id,
            ...requirement,
          })),
        });
      }
      notes.push(
        `Basic Pickaxe: ${selectedMode === "--apply" ? "requirements updated" : pickaxeMatches ? "ready" : "would replace legacy Plank with Wooden Handle"}`,
      );
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${mode.slice(2)} complete: ${COMPONENT_ITEMS.length} reusable items, ${COMPONENT_CRAFTS.length} crafting recipes, ${COMPONENT_GATHERING_SOURCES.length} gathering source.`,
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
