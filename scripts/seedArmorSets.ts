import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  ARMOR_SET_BLUEPRINTS,
  ARMOR_SET_COMPONENTS,
  ARMOR_SET_EXISTING_DEPENDENCY_TYPES,
  ARMOR_SET_GARDEN_ITEMS,
  ARMOR_SET_GARDEN_SEED,
  ARMOR_SET_GARDEN_YIELD,
  ARMOR_SET_GATHERING_MATERIALS,
  ARMOR_SET_GEAR,
  ARMOR_SET_ITEMS,
  ARMOR_SET_SKILLS,
  armorSetItemCreateData,
  armorSetRequirementsForCraft,
} from "../prisma/content/armorSets";
import { changedFields, sameRequirements } from "./seedHelpers";

type Mode = "--check" | "--apply" | "--verify";

const mode = process.argv[2] ?? "--check";
if (
  !(mode === "--check" || mode === "--apply" || mode === "--verify") ||
  process.argv.length > 3
) {
  throw new Error(
    "Usage: npm run db:seed:armor-sets -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function assertRgbaSprite(sprite: string) {
  const png = await readFile(new URL("../public" + sprite, import.meta.url));
  if (
    png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
    png.readUInt32BE(16) !== 256 ||
    png.readUInt32BE(20) !== 256 ||
    png[24] !== 8 ||
    png[25] !== 6
  ) {
    throw new Error(sprite + ": expected a 256×256 RGBA PNG sprite");
  }
}

async function validateDefinitions() {
  if (
    ARMOR_SET_GEAR.length !== 32 ||
    ARMOR_SET_BLUEPRINTS.length !== 32 ||
    ARMOR_SET_COMPONENTS.length !== 10 ||
    ARMOR_SET_GATHERING_MATERIALS.length !== 1 ||
    ARMOR_SET_GARDEN_ITEMS.length !== 2
  ) {
    throw new Error(
      "Armor-set content must include 32 gear pieces, 32 blueprints, 10 components, one gathered fiber and two garden items",
    );
  }

  for (const key of ["slug", "name", "sprite"] as const) {
    if (
      new Set(ARMOR_SET_ITEMS.map((definition) => definition[key])).size !==
      ARMOR_SET_ITEMS.length
    ) {
      throw new Error("Armor-set item " + key + "s must be unique");
    }
  }

  const gearNames = new Set<string>(ARMOR_SET_GEAR.map((gear) => gear.name));
  const blueprintByOutput = new Map(
    ARMOR_SET_BLUEPRINTS.map((blueprint) => [
      blueprint.requiredForItemName,
      blueprint.name,
    ]),
  );
  if (
    blueprintByOutput.size !== ARMOR_SET_GEAR.length ||
    ARMOR_SET_BLUEPRINTS.some(
      (blueprint) => !gearNames.has(blueprint.requiredForItemName),
    ) ||
    ARMOR_SET_GEAR.some(
      (gear) => blueprintByOutput.get(gear.name) !== gear.requiredBlueprintName,
    )
  ) {
    throw new Error(
      "Every armor piece must have one distinct physical blueprint",
    );
  }

  const knownItemNames = new Set([
    ...Object.keys(ARMOR_SET_EXISTING_DEPENDENCY_TYPES),
    ...ARMOR_SET_ITEMS.map((item) => item.name),
  ]);
  const crafts = [...ARMOR_SET_COMPONENTS, ...ARMOR_SET_GEAR];
  for (const craft of crafts) {
    const requirements = armorSetRequirementsForCraft(craft);
    const requirementNames = new Set<string>();
    if (
      craft.requiredSkillLevel < 1 ||
      craft.defaultSeconds < 1 ||
      craft.xpPerUnit < 0 ||
      requirements.length === 0
    ) {
      throw new Error(craft.name + ": invalid craft balance");
    }
    for (const requirement of requirements) {
      if (
        !knownItemNames.has(requirement.itemName) ||
        requirement.quantityPerUnit < 1 ||
        requirementNames.has(requirement.itemName)
      ) {
        throw new Error(
          craft.name + ": invalid requirement " + requirement.itemName,
        );
      }
      requirementNames.add(requirement.itemName);
    }
  }

  const requiredCraftingSkills = new Set([
    "ALCHEMY",
    "BLACKSMITHING",
    "CARPENTRY",
    "TAILORING",
    "WEAPONSMITHING",
  ]);
  const configuredCraftingSkills = new Set(
    ARMOR_SET_COMPONENTS.map((component) => component.actionType),
  );
  if (
    configuredCraftingSkills.size !== requiredCraftingSkills.size ||
    [...requiredCraftingSkills].some(
      (skill) => !configuredCraftingSkills.has(skill as never),
    )
  ) {
    throw new Error(
      "Armor components must exercise every supported crafting skill",
    );
  }

  const gardenSeed = ARMOR_SET_GARDEN_SEED;
  if (
    !gardenSeed?.seedYieldItemName ||
    gardenSeed.seedYieldMin === undefined ||
    gardenSeed.seedYieldMax === undefined ||
    ARMOR_SET_GARDEN_YIELD.name !== gardenSeed.seedYieldItemName ||
    gardenSeed.seedYieldMin < 1 ||
    gardenSeed.seedYieldMax < gardenSeed.seedYieldMin
  ) {
    throw new Error("Emberbloom seed must point to a valid garden yield");
  }

  for (const item of ARMOR_SET_ITEMS) await assertRgbaSprite(item.sprite);
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const notes: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const dependencyNames = Object.keys(ARMOR_SET_EXISTING_DEPENDENCY_TYPES);
      const dependencyItems = await tx.item.findMany({
        where: { name: { in: dependencyNames } },
        select: { id: true, name: true, itemType: true },
      });
      const itemIds = new Map<string, number>();
      for (const [name, expectedType] of Object.entries(
        ARMOR_SET_EXISTING_DEPENDENCY_TYPES,
      )) {
        const matches = dependencyItems.filter((item) => item.name === name);
        if (matches.length !== 1 || matches[0]?.itemType !== expectedType) {
          throw new Error(
            name + ": expected exactly one existing " + expectedType + " item",
          );
        }
        itemIds.set(name, matches[0].id);
      }

      const existingItems = await tx.item.findMany({
        where: {
          OR: [
            { name: { in: ARMOR_SET_ITEMS.map((item) => item.name) } },
            { sprite: { in: ARMOR_SET_ITEMS.map((item) => item.sprite) } },
          ],
        },
        include: { stats: true },
      });

      for (const definition of ARMOR_SET_ITEMS) {
        const nameMatches = existingItems.filter(
          (item) => item.name === definition.name,
        );
        const spriteMatches = existingItems.filter(
          (item) => item.sprite === definition.sprite,
        );
        const candidateIds = new Set(
          [...nameMatches, ...spriteMatches].map((item) => item.id),
        );
        if (
          nameMatches.length > 1 ||
          spriteMatches.length > 1 ||
          candidateIds.size > 1 ||
          (spriteMatches[0] && spriteMatches[0].name !== definition.name)
        ) {
          throw new Error("Conflicting item template for " + definition.name);
        }

        const found = nameMatches[0] ?? spriteMatches[0] ?? null;
        const fullData = armorSetItemCreateData(definition);
        const { stats: _stats, ...scalarData } = fullData;
        const scalarDifferences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              scalarData as unknown as Record<string, unknown>,
            )
          : Object.keys(scalarData);
        const expectedStats =
          "stats" in definition ? Object.entries(definition.stats) : [];
        const statsMatch =
          (found?.stats.length ?? 0) === expectedStats.length &&
          expectedStats.every(([statType, value]) =>
            found?.stats.some(
              (stat) => stat.statType === statType && stat.value === value,
            ),
          );
        if (
          selectedMode === "--verify" &&
          (!found || scalarDifferences.length > 0 || !statsMatch)
        ) {
          throw new Error(
            definition.name +
              ": item differs (" +
              (scalarDifferences.join(", ") || "stats") +
              ")",
          );
        }

        let itemId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const written = found
            ? await tx.item.update({
                where: { id: found.id },
                data: scalarData,
              })
            : await tx.item.create({ data: fullData });
          itemId = written.id;
          if (found) {
            await tx.itemStat.deleteMany({ where: { itemId: written.id } });
            if (expectedStats.length > 0) {
              await tx.itemStat.createMany({
                data: expectedStats.map(([statType, value]) => ({
                  itemId: written.id,
                  statType:
                    statType as (typeof found.stats)[number]["statType"],
                  value,
                })),
              });
            }
          }
        }
        if (itemId) itemIds.set(definition.name, itemId);
        notes.push(
          definition.name +
            ": " +
            (selectedMode === "--apply"
              ? found
                ? "updated"
                : "created"
              : found && scalarDifferences.length === 0 && statsMatch
                ? "ready"
                : "would write"),
        );
      }

      const gardenSeed = ARMOR_SET_GARDEN_SEED;
      const gardenYieldId = itemIds.get(gardenSeed.seedYieldItemName!);
      const gardenSeedId = itemIds.get(gardenSeed.name);
      const persistedGardenSeed = existingItems.find(
        (item) => item.name === gardenSeed.name,
      );
      if (
        selectedMode === "--verify" &&
        (!persistedGardenSeed ||
          persistedGardenSeed.seedYieldItemId !== gardenYieldId)
      ) {
        throw new Error("Emberbloom seed yield relation differs");
      }
      if (selectedMode === "--apply") {
        if (!gardenYieldId || !gardenSeedId) {
          throw new Error("Missing Emberbloom seed or garden yield item");
        }
        await tx.item.update({
          where: { id: gardenSeedId },
          data: { seedYieldItem: { connect: { id: gardenYieldId } } },
        });
      }

      for (const skill of ARMOR_SET_SKILLS) {
        const found = await tx.skills.findUnique({
          where: { skill_name: skill.skill_name },
        });
        if (
          selectedMode === "--verify" &&
          (!found || found.category !== skill.category)
        ) {
          throw new Error(skill.skill_name + ": skill is missing or differs");
        }
        if (selectedMode === "--apply") {
          await tx.skills.upsert({
            where: { skill_name: skill.skill_name },
            create: skill,
            update: { category: skill.category },
          });
        }
        notes.push(
          skill.skill_name +
            " skill: " +
            (found
              ? "present"
              : selectedMode === "--apply"
                ? "created"
                : "would create"),
        );
      }

      const locations = await tx.location.findMany({
        select: {
          id: true,
          name: true,
          gatheringEnabled: true,
          gatheringRequiredLevel: true,
        },
        orderBy: [{ id: "asc" }],
      });
      if (locations.length === 0) {
        throw new Error(
          "At least one location is required before seeding armor",
        );
      }
      const locationsByName = new Map(
        locations.map((location) => [location.name, location]),
      );

      for (const material of ARMOR_SET_GATHERING_MATERIALS) {
        const itemId = itemIds.get(material.name);
        const mountDoom = locationsByName.get(material.locationName);
        if (!mountDoom) {
          throw new Error(
            "Existing location not found: " + material.locationName,
          );
        }
        if (!itemId) {
          if (selectedMode === "--check") {
            notes.push(material.name + ": would configure Gathering source");
            continue;
          }
          throw new Error("Missing Gathering item: " + material.name);
        }
        const expectedResource = {
          actionType: "GATHERING" as const,
          name: material.name,
          itemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: material.requiredSkillLevel,
          defaultSeconds: 3_600,
          yieldPerUnit: 1,
          xpPerUnit: 0,
          rarity: material.rarity,
        };
        const found = await tx.vocationalResource.findUnique({
          where: { itemId },
        });
        if (found && found.actionType !== "GATHERING") {
          throw new Error(
            material.name + " already belongs to " + found.actionType,
          );
        }
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expectedResource as unknown as Record<string, unknown>,
            )
          : Object.keys(expectedResource);
        if (selectedMode === "--verify" && (!found || differences.length > 0)) {
          throw new Error(material.name + ": Gathering resource differs");
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
          await tx.location.update({
            where: { id: mountDoom.id },
            data: {
              gatheringEnabled: true,
              gatheringRequiredLevel: material.locationRequiredGatheringLevel,
            },
          });
        }
        if (
          selectedMode === "--verify" &&
          (!mountDoom.gatheringEnabled ||
            mountDoom.gatheringRequiredLevel !==
              material.locationRequiredGatheringLevel)
        ) {
          throw new Error("Mount Doom Gathering access differs");
        }
        if (!resourceId) continue;

        const expectedJoin = {
          enabled: true,
          gatheringBaseChance: material.baseChance,
          gatheringMinQuantity: material.minQuantity,
          gatheringMaxQuantity: material.maxQuantity,
        };
        const foundJoin = await tx.locationVocationalResource.findUnique({
          where: {
            locationId_resourceId: {
              locationId: mountDoom.id,
              resourceId,
            },
          },
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
          throw new Error("Mount Doom/" + material.name + ": pool differs");
        }
        if (selectedMode === "--apply") {
          await tx.locationVocationalResource.upsert({
            where: {
              locationId_resourceId: {
                locationId: mountDoom.id,
                resourceId,
              },
            },
            create: { locationId: mountDoom.id, resourceId, ...expectedJoin },
            update: expectedJoin,
          });
        }
        notes.push(material.name + ": Gathering source configured");
      }

      for (const craft of [...ARMOR_SET_COMPONENTS, ...ARMOR_SET_GEAR]) {
        const outputItemId = itemIds.get(craft.name);
        const requirementDefinitions = armorSetRequirementsForCraft(craft);
        const requirementRows = requirementDefinitions.flatMap(
          (requirement) => {
            const itemId = itemIds.get(requirement.itemName);
            return itemId
              ? [{ itemId, quantityPerUnit: requirement.quantityPerUnit }]
              : [];
          },
        );
        if (
          !outputItemId ||
          requirementRows.length !== requirementDefinitions.length
        ) {
          if (selectedMode === "--check") {
            notes.push(craft.name + ": would configure " + craft.actionType);
            continue;
          }
          throw new Error(craft.name + ": missing output or requirement item");
        }

        const expectedResource = {
          actionType: craft.actionType,
          name: craft.name,
          itemId: outputItemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: craft.requiredSkillLevel,
          defaultSeconds: craft.defaultSeconds,
          yieldPerUnit: 1,
          xpPerUnit: craft.xpPerUnit,
          rarity: craft.rarity,
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
            craft.name + " already belongs to " + found.actionType,
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
        const locationsMatch = locations.every((location) =>
          enabledLocations.has(location.id),
        );
        if (
          selectedMode === "--verify" &&
          (!found ||
            differences.length > 0 ||
            !requirementsMatch ||
            !locationsMatch)
        ) {
          throw new Error(
            craft.name + ": " + craft.actionType + " recipe differs",
          );
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
        notes.push(craft.name + ": " + craft.actionType + " recipe configured");
      }
    },
    { maxWait: 10_000, timeout: 90_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    selectedMode.slice(2) +
      " complete: 4 full armor sets, " +
      ARMOR_SET_GEAR.length +
      " blueprint-gated armor crafts, " +
      ARMOR_SET_COMPONENTS.length +
      " cross-vocation components.",
  );
}

void main(mode as Mode)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
