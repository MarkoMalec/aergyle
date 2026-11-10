import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  TAILORING_BLUEPRINTS,
  TAILORING_GATHERING_POOLS,
  TAILORING_GEAR,
  TAILORING_ITEMS,
  TAILORING_MATERIALS,
  TAILORING_TEXTILES,
  tailoringItemCreateData,
  tailoringRequirementsForGear,
} from "../prisma/content/tailoring";
import { changedFields, sameRequirements } from "./seedHelpers";

type Mode = "--check" | "--apply" | "--verify";
const mode = process.argv[2] ?? "--check";
if (!(mode === "--check" || mode === "--apply" || mode === "--verify")) {
  throw new Error(
    "Usage: npm run db:seed:tailoring -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function validateDefinitions() {
  if (TAILORING_MATERIALS.length !== 6) {
    throw new Error("Tailoring must ship exactly six base materials");
  }
  if (
    TAILORING_BLUEPRINTS.length !== 4 ||
    TAILORING_GEAR.length !== 4 ||
    TAILORING_TEXTILES.length !== 6
  ) {
    throw new Error(
      "Tailoring must ship four blueprints, six textile crafts and four gear pieces",
    );
  }
  const gearNames = new Set(TAILORING_GEAR.map((item) => item.name));
  const blueprintByGear = new Map(
    TAILORING_BLUEPRINTS.map((blueprint) => [
      blueprint.requiredForItemName,
      blueprint.name,
    ]),
  );
  if (
    TAILORING_BLUEPRINTS.some(
      (blueprint) => !gearNames.has(blueprint.requiredForItemName),
    ) ||
    blueprintByGear.size !== TAILORING_GEAR.length ||
    TAILORING_GEAR.some(
      (gear) => blueprintByGear.get(gear.name) !== gear.requiredBlueprintName,
    )
  ) {
    throw new Error("Every Tailoring item must have one distinct blueprint");
  }

  for (const item of TAILORING_ITEMS) {
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
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const notes: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const itemNames = TAILORING_ITEMS.map((item) => item.name);
      const itemSprites = TAILORING_ITEMS.map((item) => item.sprite);
      const existingItems = await tx.item.findMany({
        where: {
          OR: [{ name: { in: itemNames } }, { sprite: { in: itemSprites } }],
        },
        include: { stats: true },
      });
      const itemIds = new Map<string, number>();

      for (const definition of TAILORING_ITEMS) {
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

        const found = nameMatches[0] ?? spriteMatches[0] ?? null;
        const fullData = tailoringItemCreateData(definition);
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
            `${definition.name}: item differs (${scalarDifferences.join(", ") || "stats"})`,
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
          `${definition.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : found && scalarDifferences.length === 0 && statsMatch ? "ready" : "would write"}`,
        );
      }

      const skillDescription =
        "Turn cloth, hides and rare fibers into practical apparel and leather goods.";
      const existingSkill = await tx.skills.findUnique({
        where: { skill_name: "Tailoring" },
      });
      if (
        selectedMode === "--verify" &&
        (!existingSkill ||
          existingSkill.description !== skillDescription ||
          existingSkill.category !== "CRAFTING")
      ) {
        throw new Error("Tailoring skill is missing or differs");
      }
      if (selectedMode === "--apply") {
        await tx.skills.upsert({
          where: { skill_name: "Tailoring" },
          create: {
            skill_name: "Tailoring",
            description: skillDescription,
            category: "CRAFTING",
          },
          update: { description: skillDescription, category: "CRAFTING" },
        });
      }
      notes.push(
        `Tailoring skill: ${existingSkill ? "present" : "would create"}`,
      );

      const locations = await tx.location.findMany({
        select: { id: true, name: true },
        orderBy: [{ id: "asc" }],
      });
      if (locations.length === 0) {
        throw new Error(
          "At least one location is required before seeding Tailoring",
        );
      }
      const locationsByName = new Map(
        locations.map((location) => [location.name, location]),
      );
      for (const pool of TAILORING_GATHERING_POOLS) {
        if (!locationsByName.has(pool.locationName)) {
          throw new Error(`Existing location not found: ${pool.locationName}`);
        }
      }

      for (const material of TAILORING_MATERIALS.filter(
        (material) => material.acquisition === "GATHERING",
      )) {
        const itemId = itemIds.get(material.name);
        if (!itemId) {
          if (selectedMode === "--check") continue;
          throw new Error(`Missing material item: ${material.name}`);
        }
        const expectedResource = {
          actionType: "GATHERING" as const,
          name: material.name,
          itemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: material.requiredGatheringLevel,
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
            `${material.name} already belongs to ${found.actionType}`,
          );
        }
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expectedResource as unknown as Record<string, unknown>,
            )
          : Object.keys(expectedResource);
        if (selectedMode === "--verify" && (!found || differences.length > 0)) {
          throw new Error(`${material.name}: Gathering resource differs`);
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

        for (const pool of TAILORING_GATHERING_POOLS) {
          const entry = pool.resources.find(
            (resource) => resource.itemName === material.name,
          );
          if (!entry) continue;
          const locationId = locationsByName.get(pool.locationName)!.id;
          const expectedJoin = {
            enabled: true,
            gatheringBaseChance: entry.baseChance,
            gatheringMinQuantity: entry.min,
            gatheringMaxQuantity: entry.max,
          };
          const join = await tx.locationVocationalResource.findUnique({
            where: { locationId_resourceId: { locationId, resourceId } },
          });
          const joinDifferences = join
            ? changedFields(
                join as unknown as Record<string, unknown>,
                expectedJoin,
              )
            : Object.keys(expectedJoin);
          if (
            selectedMode === "--verify" &&
            (!join || joinDifferences.length > 0)
          ) {
            throw new Error(
              `${pool.locationName}/${material.name}: pool differs`,
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
        notes.push(`${material.name}: Gathering source configured`);
      }

      // Silk is deliberately an import rather than a lucky field find. Every
      // active trader carries a small, expensive supply so it has a reliable
      // in-world source without flattening the higher tailoring tiers.
      const importedMaterials = TAILORING_MATERIALS.filter(
        (material) => material.acquisition === "IMPORT",
      );
      if (importedMaterials.length > 0) {
        const vendors = await tx.npc.findMany({
          where: { enabled: true },
          include: {
            offers: {
              where: {
                itemId: {
                  in: importedMaterials
                    .map((material) => itemIds.get(material.name))
                    .filter((id): id is number => id !== undefined),
                },
              },
            },
          },
        });

        for (const material of importedMaterials) {
          const itemId = itemIds.get(material.name);
          if (!itemId) {
            if (selectedMode !== "--check") {
              throw new Error(
                `Missing imported material item: ${material.name}`,
              );
            }
            continue;
          }
          const expectedOffer = {
            price: material.price * 2,
            enabled: true,
            sortOrder: 80,
            availableFrom: null,
            availableUntil: null,
            requiredProjectId: null,
          };
          for (const vendor of vendors) {
            const matches = vendor.offers.filter(
              (offer) => offer.itemId === itemId,
            );
            const differs =
              matches.length !== 1 ||
              matches.some(
                (offer) =>
                  Number(offer.price) !== Number(expectedOffer.price) ||
                  offer.enabled !== expectedOffer.enabled ||
                  offer.sortOrder !== expectedOffer.sortOrder ||
                  offer.availableFrom !== expectedOffer.availableFrom ||
                  offer.availableUntil !== expectedOffer.availableUntil ||
                  offer.requiredProjectId !== expectedOffer.requiredProjectId,
              );
            if (selectedMode === "--verify" && differs) {
              throw new Error(
                `${vendor.name}: ${material.name} import offer differs`,
              );
            }
            if (selectedMode === "--apply") {
              const primary = matches[0];
              if (primary) {
                await tx.npcOffer.update({
                  where: { id: primary.id },
                  data: expectedOffer,
                });
                if (matches.length > 1) {
                  await tx.npcOffer.deleteMany({
                    where: {
                      id: { in: matches.slice(1).map((offer) => offer.id) },
                    },
                  });
                }
              } else {
                await tx.npcOffer.create({
                  data: { npcId: vendor.id, itemId, ...expectedOffer },
                });
              }
            }
          }
          notes.push(`${material.name}: import stock configured`);
        }
      }

      for (const craft of [...TAILORING_TEXTILES, ...TAILORING_GEAR]) {
        const outputItemId = itemIds.get(craft.name);
        const requirementDefinitions =
          "requiredBlueprintName" in craft
            ? tailoringRequirementsForGear(craft)
            : craft.requirements;
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
          if (selectedMode === "--check") continue;
          throw new Error(`${craft.name}: missing output or requirement item`);
        }

        const expectedResource = {
          actionType: "TAILORING" as const,
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
        if (found && found.actionType !== "TAILORING") {
          throw new Error(
            `${craft.name} already belongs to ${found.actionType}`,
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
          throw new Error(`${craft.name}: Tailoring recipe differs`);
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
        notes.push(`${craft.name}: Tailoring recipe configured`);
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${mode.slice(2)} complete: ${TAILORING_GEAR.length + TAILORING_TEXTILES.length} crafts, ${TAILORING_BLUEPRINTS.length} physical blueprint requirements, ${TAILORING_MATERIALS.filter((material) => material.acquisition === "GATHERING").length} gathered materials, and ${TAILORING_MATERIALS.filter((material) => material.acquisition === "IMPORT").length} import material.`,
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
