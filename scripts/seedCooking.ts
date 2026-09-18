import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  COOKING_DISHES,
  COOKING_EXISTING_INGREDIENT_TYPES,
  COOKING_ITEMS,
  COOKING_SEEDS,
  type CookingItemDefinition,
  cookingItemCreateData,
} from "../prisma/content/cooking";

const mode = process.argv[2] ?? "--check";
if (!["--check", "--apply", "--verify"].includes(mode)) {
  throw new Error(
    "Usage: npm run db:seed:cooking -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

type Mode = "--check" | "--apply" | "--verify";

function changedFields(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
) {
  return Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key]) => key);
}

async function validateSprites() {
  for (const sprite of new Set(COOKING_ITEMS.map((item) => item.sprite))) {
    const png = await readFile(new URL(`../public${sprite}`, import.meta.url));
    if (
      png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== 256 ||
      png.readUInt32BE(20) !== 256 ||
      png[25] !== 6
    ) {
      throw new Error(`${sprite}: expected a 256×256 RGBA PNG sprite`);
    }
  }
}

async function main(selectedMode: Mode) {
  await validateSprites();

  const rows: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const requiredExistingNames = Object.keys(
        COOKING_EXISTING_INGREDIENT_TYPES,
      );
      const requiredExistingItems = await tx.item.findMany({
        where: { name: { in: requiredExistingNames } },
        select: { id: true, name: true, itemType: true },
      });

      for (const [name, expectedType] of Object.entries(
        COOKING_EXISTING_INGREDIENT_TYPES,
      )) {
        const matches = requiredExistingItems.filter(
          (item) => item.name === name,
        );
        if (matches.length !== 1 || matches[0]?.itemType !== expectedType) {
          throw new Error(
            `${name}: expected exactly one existing ${expectedType} item template`,
          );
        }
      }

      const itemsByName = new Map(
        requiredExistingItems.map((item) => [item.name, item]),
      );

      for (const definition of COOKING_ITEMS) {
        const itemDefinition = definition as CookingItemDefinition;
        const seedYieldItem = itemDefinition.seedYieldItemName
          ? itemsByName.get(itemDefinition.seedYieldItemName)
          : null;
        if (
          itemDefinition.seedYieldItemName &&
          !seedYieldItem &&
          selectedMode !== "--check"
        ) {
          throw new Error(
            `${definition.name}: missing seed yield item ${itemDefinition.seedYieldItemName}`,
          );
        }
        const expected = {
          ...cookingItemCreateData(definition),
          seedYieldItemId: seedYieldItem?.id ?? null,
        };
        const matches = await tx.item.findMany({
          where: { name: definition.name },
          include: {
            foodEffectStats: {
              select: { statType: true, value: true },
            },
          },
        });
        if (matches.length > 1) {
          throw new Error(`${definition.name}: duplicate item templates found`);
        }

        const found = matches[0] ?? null;
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : Object.keys(expected);

        const expectedFoodStats = itemDefinition.foodEffectStats ?? [];
        const actualFoodStats = new Map(
          found?.foodEffectStats.map((stat) => [stat.statType, stat.value]) ??
            [],
        );
        const foodStatsMatch =
          actualFoodStats.size === expectedFoodStats.length &&
          expectedFoodStats.every(
            (stat) => actualFoodStats.get(stat.statType) === stat.value,
          );

        if (
          selectedMode === "--verify" &&
          (!found || differences.length > 0 || !foodStatsMatch)
        ) {
          throw new Error(
            `${definition.name}: ${found ? `item or food effects differ (${differences.join(", ")})` : "missing"}`,
          );
        }

        let itemId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const writtenItem = found
            ? await tx.item.update({
                where: { id: found.id },
                data: expected,
              })
            : await tx.item.create({
                data: expected,
              });

          itemId = writtenItem.id;
          await tx.foodEffectStat.deleteMany({ where: { itemId } });
          if (expectedFoodStats.length > 0) {
            await tx.foodEffectStat.createMany({
              data: expectedFoodStats.map((stat) => ({
                itemId: itemId!,
                ...stat,
              })),
            });
          }
        }

        if (itemId) {
          itemsByName.set(definition.name, {
            id: itemId,
            name: definition.name,
            itemType: definition.itemType,
          });
        }
        rows.push(
          `${definition.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : found && differences.length === 0 && foodStatsMatch ? "ready" : "would write"}`,
        );
      }

      const existingSkill = await tx.skills.findUnique({
        where: { skill_name: "Cooking" },
      });
      const skillDescription =
        "Turn fish, meat and vegetables into nourishing dishes learned from recipes.";
      if (selectedMode === "--verify") {
        if (
          !existingSkill ||
          existingSkill.description !== skillDescription ||
          existingSkill.category !== "CRAFTING"
        ) {
          throw new Error("Cooking skill is missing or differs");
        }
      } else if (selectedMode === "--apply") {
        await tx.skills.upsert({
          where: { skill_name: "Cooking" },
          create: {
            skill_name: "Cooking",
            description: skillDescription,
            category: "CRAFTING",
          },
          update: { description: skillDescription, category: "CRAFTING" },
        });
      }
      rows.push(`Cooking skill: ${existingSkill ? "present" : "would create"}`);

      // The first Cooking action may have been renamed to Pan-fried Perch in
      // admin before its distinct output item existed. Preserve that action
      // and its location links by moving it to the new output item once.
      const panFriedPerchItem = itemsByName.get("Pan-fried Perch");
      const charredMinnowItem = itemsByName.get("Charred Silver Minnow");
      if (panFriedPerchItem && charredMinnowItem) {
        const panFriedPerchResource = await tx.vocationalResource.findUnique({
          where: { itemId: panFriedPerchItem.id },
        });
        const renamedStarterResources = await tx.vocationalResource.findMany({
          where: {
            actionType: "COOKING",
            name: "Pan-fried Perch",
            itemId: charredMinnowItem.id,
          },
        });
        if (!panFriedPerchResource && renamedStarterResources.length === 1) {
          if (selectedMode === "--apply") {
            await tx.vocationalResource.update({
              where: { id: renamedStarterResources[0]!.id },
              data: { itemId: panFriedPerchItem.id },
            });
          }
          rows.push(
            `Pan-fried Perch action: ${selectedMode === "--apply" ? "preserved and relinked" : "would relink output item"}`,
          );
        }
      }

      const locations = await tx.location.findMany({
        select: { id: true, name: true },
        orderBy: [{ id: "asc" }],
      });
      if (locations.length === 0) {
        throw new Error(
          "At least one location is required before seeding Cooking",
        );
      }

      for (const dish of COOKING_DISHES) {
        const outputItem = itemsByName.get(dish.name);
        const recipeItem = dish.requiredRecipeName
          ? itemsByName.get(dish.requiredRecipeName)
          : null;
        const missingRequirement = dish.requirements.find(
          (requirement) => !itemsByName.has(requirement.itemName),
        );

        if (
          !outputItem ||
          (dish.requiredRecipeName && !recipeItem) ||
          missingRequirement
        ) {
          if (selectedMode === "--check") {
            rows.push(`${dish.name}: would create cooking resource`);
            continue;
          }
          if (!outputItem) throw new Error(`Missing output item: ${dish.name}`);
          if (dish.requiredRecipeName && !recipeItem) {
            throw new Error(`Missing recipe item: ${dish.requiredRecipeName}`);
          }
          throw new Error(
            `Missing cooking ingredient: ${missingRequirement!.itemName}`,
          );
        }

        const requirementRows = dish.requirements.map((requirement) => ({
          itemId: itemsByName.get(requirement.itemName)!.id,
          quantityPerUnit: requirement.quantityPerUnit,
        }));

        const found = await tx.vocationalResource.findUnique({
          where: { itemId: outputItem.id },
          include: {
            requirements: {
              select: { itemId: true, quantityPerUnit: true },
            },
            locations: { select: { locationId: true, enabled: true } },
          },
        });
        const expectedResource = {
          actionType: "COOKING" as const,
          name: dish.name,
          itemId: outputItem.id,
          requiredRecipeItemId: recipeItem?.id ?? null,
          requiredSkillLevel: dish.requiredSkillLevel,
          defaultSeconds: dish.defaultSeconds,
          yieldPerUnit: 1,
          xpPerUnit: dish.xpPerUnit,
          rarity: dish.rarity,
        };

        const scalarDifferences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expectedResource as unknown as Record<string, unknown>,
            )
          : Object.keys(expectedResource);
        const actualRequirements = new Map(
          found?.requirements.map((requirement) => [
            requirement.itemId,
            requirement.quantityPerUnit,
          ]) ?? [],
        );
        const requirementsMatch =
          actualRequirements.size === requirementRows.length &&
          requirementRows.every(
            (requirement) =>
              actualRequirements.get(requirement.itemId) ===
              requirement.quantityPerUnit,
          );
        const enabledLocationIds = new Set(
          found?.locations
            .filter((location) => location.enabled)
            .map((location) => location.locationId) ?? [],
        );
        const locationsMatch = locations.every((location) =>
          enabledLocationIds.has(location.id),
        );

        if (
          selectedMode === "--verify" &&
          (!found ||
            scalarDifferences.length > 0 ||
            !requirementsMatch ||
            !locationsMatch)
        ) {
          throw new Error(`${dish.name}: cooking resource differs`);
        }

        if (selectedMode === "--apply") {
          const resource = await tx.vocationalResource.upsert({
            where: { itemId: outputItem.id },
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

        rows.push(
          `${dish.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : found && scalarDifferences.length === 0 && requirementsMatch && locationsMatch ? "ready" : "would write"}`,
        );
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(rows.map((result) => ({ result })));
  console.log(
    `${selectedMode.slice(2)} complete: ${COOKING_DISHES.length} dishes, ${COOKING_DISHES.filter((dish) => dish.requiredRecipeName).length} recipe gates, ${COOKING_SEEDS.length} seed types.`,
  );
}

main(mode as Mode)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
