import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  GATHERING_DURATIONS,
  GATHERING_ITEMS,
  GATHERING_LOCATIONS,
  gatheringItemData,
} from "../prisma/content/gathering";
import { changedFields } from "./seedHelpers";

const mode = process.argv[2] ?? "--check";
if (!(["--check", "--apply", "--verify"] as const).includes(mode as never)) {
  throw new Error(
    "Usage: npm run db:seed:gathering -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

type Mode = "--check" | "--apply" | "--verify";
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function validateContent() {
  if (GATHERING_ITEMS.length !== 18) {
    throw new Error("Gathering content must contain eighteen resources");
  }
  if (
    GATHERING_ITEMS.filter((item) => item.itemType === "HERB").length !== 12
  ) {
    throw new Error("Gathering content must contain twelve herbs");
  }
  if (!GATHERING_ITEMS.some((item) => item.name === "Mushrooms")) {
    throw new Error("Mushrooms are required in the initial resource pool");
  }
  if (
    new Set(GATHERING_ITEMS.map((item) => item.name)).size !==
    GATHERING_ITEMS.length
  ) {
    throw new Error("Gathering item names must be unique");
  }

  for (const item of GATHERING_ITEMS) {
    const png = await readFile(
      new URL(`../public${item.sprite}`, import.meta.url),
    );
    if (
      png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== 256 ||
      png.readUInt32BE(20) !== 256 ||
      png[25] !== 6
    ) {
      throw new Error(`${item.sprite}: expected a 256×256 RGBA PNG sprite`);
    }
  }

  const itemNames = new Set(GATHERING_ITEMS.map((item) => item.name));
  for (const location of GATHERING_LOCATIONS) {
    for (const resource of location.resources) {
      if (!itemNames.has(resource.itemName)) {
        throw new Error(
          `${location.name}: unknown resource ${resource.itemName}`,
        );
      }
      if (
        resource.baseChance <= 0 ||
        resource.baseChance > 1 ||
        resource.minQuantity < 1 ||
        resource.maxQuantity < resource.minQuantity
      ) {
        throw new Error(
          `${location.name}/${resource.itemName}: invalid reward balance`,
        );
      }
    }
  }
}

async function main(selectedMode: Mode) {
  await validateContent();
  const notes: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const itemNames = GATHERING_ITEMS.map((item) => item.name);
      const itemSprites = GATHERING_ITEMS.map((item) => item.sprite);
      const existingItems = await tx.item.findMany({
        where: {
          OR: [{ name: { in: itemNames } }, { sprite: { in: itemSprites } }],
        },
      });
      const itemIds = new Map<string, number>();

      for (const definition of GATHERING_ITEMS) {
        const expected = gatheringItemData(definition);
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
          throw new Error(`Conflicting item template for ${definition.name}`);
        }
        // Reuse an equivalent same-name template even when it has legacy art;
        // apply mode updates it in place rather than creating a duplicate concept.
        const found = nameMatches[0] ?? spriteMatches[0] ?? null;
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

        let itemId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const written = found
            ? await tx.item.update({ where: { id: found.id }, data: expected })
            : await tx.item.create({ data: expected });
          itemId = written.id;
        }
        if (itemId) itemIds.set(definition.name, itemId);
        notes.push(
          `${definition.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : found && diff.length === 0 ? "ready" : "would write"}`,
        );
      }

      const databaseLocations = await tx.location.findMany({
        where: {
          name: { in: GATHERING_LOCATIONS.map((location) => location.name) },
        },
      });
      const locationsByName = new Map(
        databaseLocations.map((location) => [location.name, location]),
      );
      for (const definition of GATHERING_LOCATIONS) {
        const location = locationsByName.get(definition.name);
        if (!location) {
          throw new Error(`Existing location not found: ${definition.name}`);
        }
        const locationDiff = changedFields(
          location as unknown as Record<string, unknown>,
          {
            gatheringEnabled: true,
            gatheringRequiredLevel: definition.requiredGatheringLevel,
          },
        );
        if (selectedMode === "--verify" && locationDiff.length > 0) {
          throw new Error(`${definition.name}: Gathering location differs`);
        }
        if (selectedMode === "--apply") {
          await tx.location.update({
            where: { id: location.id },
            data: {
              gatheringEnabled: true,
              gatheringRequiredLevel: definition.requiredGatheringLevel,
            },
          });
        }
      }

      for (const itemDefinition of GATHERING_ITEMS) {
        const itemId = itemIds.get(itemDefinition.name);
        if (!itemId) {
          if (selectedMode === "--check") {
            notes.push(
              `${itemDefinition.name}: would create expedition resource`,
            );
            continue;
          }
          throw new Error(`Missing Gathering item: ${itemDefinition.name}`);
        }
        const expected = {
          actionType: "GATHERING" as const,
          name: itemDefinition.name,
          itemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: itemDefinition.requiredSkillLevel,
          defaultSeconds: 3_600,
          yieldPerUnit: 1,
          xpPerUnit: 0,
          rarity: itemDefinition.rarity,
        };
        const found = await tx.vocationalResource.findUnique({
          where: { itemId },
        });
        if (found && found.actionType !== "GATHERING") {
          throw new Error(
            `${itemDefinition.name} already belongs to ${found.actionType}`,
          );
        }
        const diff = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(`${itemDefinition.name}: Gathering resource differs`);
        }

        let resourceId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const resource = await tx.vocationalResource.upsert({
            where: { itemId },
            create: expected,
            update: expected,
          });
          resourceId = resource.id;
        }
        if (!resourceId) continue;

        for (const locationDefinition of GATHERING_LOCATIONS) {
          const locationResource = locationDefinition.resources.find(
            (resource) => resource.itemName === itemDefinition.name,
          );
          if (!locationResource) continue;
          const location = locationsByName.get(locationDefinition.name)!;
          const expectedJoin = {
            enabled: true,
            gatheringBaseChance: locationResource.baseChance,
            gatheringMinQuantity: locationResource.minQuantity,
            gatheringMaxQuantity: locationResource.maxQuantity,
          };
          const join = await tx.locationVocationalResource.findUnique({
            where: {
              locationId_resourceId: { locationId: location.id, resourceId },
            },
          });
          const joinDiff = join
            ? changedFields(
                join as unknown as Record<string, unknown>,
                expectedJoin,
              )
            : Object.keys(expectedJoin);
          if (selectedMode === "--verify" && (!join || joinDiff.length > 0)) {
            throw new Error(
              `${location.name}/${itemDefinition.name}: pool entry differs`,
            );
          }
          if (selectedMode === "--apply") {
            await tx.locationVocationalResource.upsert({
              where: {
                locationId_resourceId: { locationId: location.id, resourceId },
              },
              create: { locationId: location.id, resourceId, ...expectedJoin },
              update: expectedJoin,
            });
          }
        }
      }

      for (const definition of GATHERING_DURATIONS) {
        const found = await tx.gatheringDuration.findFirst({
          where: {
            OR: [
              { label: definition.label },
              { durationSeconds: definition.durationSeconds },
            ],
          },
        });
        const expected = { ...definition, enabled: true };
        const diff = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : Object.keys(expected);
        if (selectedMode === "--verify" && (!found || diff.length > 0)) {
          throw new Error(`${definition.label}: duration differs`);
        }
        if (selectedMode === "--apply") {
          if (found) {
            await tx.gatheringDuration.update({
              where: { id: found.id },
              data: expected,
            });
          } else {
            await tx.gatheringDuration.create({ data: expected });
          }
        }
      }

      const skills = [
        {
          skill_name: "Gardening",
          description:
            "Plant seeds, tend individual plots, and harvest ripe crops.",
          category: "VOCATION" as const,
        },
        {
          skill_name: "Gathering",
          description:
            "Explore your current location on timed expeditions and return with a varied haul.",
          category: "VOCATION" as const,
        },
      ];
      for (const skill of skills) {
        const found = await tx.skills.findUnique({
          where: { skill_name: skill.skill_name },
        });
        if (
          selectedMode === "--verify" &&
          (!found ||
            found.description !== skill.description ||
            found.category !== skill.category)
        ) {
          throw new Error(`${skill.skill_name}: skill definition differs`);
        }
        if (selectedMode === "--apply") {
          await tx.skills.upsert({
            where: { skill_name: skill.skill_name },
            create: skill,
            update: {
              description: skill.description,
              category: skill.category,
            },
          });
        }
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${selectedMode.slice(2)} complete: ${GATHERING_ITEMS.length} resources, ${GATHERING_LOCATIONS.length} existing locations, ${GATHERING_DURATIONS.length} durations.`,
  );
}

async function run() {
  try {
    await main(mode as Mode);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
