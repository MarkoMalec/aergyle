import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  ALCHEMY_HERB_TYPES,
  ALCHEMY_ITEMS,
  ALCHEMY_POTIONS,
  alchemyItemCreateData,
} from "../prisma/content/alchemy";
import { changedFields, sameRequirements } from "./seedHelpers";

type Mode = "--check" | "--apply" | "--verify";

const mode = process.argv[2] ?? "--check";
if (
  !(mode === "--check" || mode === "--apply" || mode === "--verify") ||
  process.argv.length > 3
) {
  throw new Error(
    "Usage: npm run db:seed:alchemy -- [--check|--apply|--verify]",
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
    png[24] !== 8 ||
    png[25] !== 6
  ) {
    throw new Error(`${sprite}: expected a 256×256 RGBA PNG sprite`);
  }
}

async function validateDefinitions() {
  if (ALCHEMY_ITEMS.length !== 7 || ALCHEMY_POTIONS.length !== 5) {
    throw new Error(
      "Alchemy must ship Water, Troll Blood, and five healing consumables",
    );
  }
  for (const key of ["slug", "name", "sprite"] as const) {
    if (
      new Set(ALCHEMY_ITEMS.map((item) => item[key])).size !==
      ALCHEMY_ITEMS.length
    ) {
      throw new Error(`Alchemy item ${key}s must be unique`);
    }
  }

  const knownIngredients = new Set([
    ...Object.keys(ALCHEMY_HERB_TYPES),
    ...ALCHEMY_ITEMS.map((item) => item.name),
  ]);
  let previousHealing = 0;
  for (const potion of ALCHEMY_POTIONS) {
    if (
      potion.healingAmount <= previousHealing ||
      potion.requiredSkillLevel < 1 ||
      potion.defaultSeconds < 1 ||
      Number(potion.xpPerUnit) < 0
    ) {
      throw new Error(`${potion.name}: invalid healing progression`);
    }
    previousHealing = potion.healingAmount;

    const ingredientNames = new Set<string>();
    for (const requirement of potion.requirements) {
      if (
        !knownIngredients.has(requirement.itemName) ||
        requirement.quantityPerUnit < 1 ||
        ingredientNames.has(requirement.itemName)
      ) {
        throw new Error(
          `${potion.name}: invalid ingredient ${requirement.itemName}`,
        );
      }
      ingredientNames.add(requirement.itemName);
    }
  }

  const trollblood = ALCHEMY_POTIONS.at(-1);
  if (
    !trollblood ||
    trollblood.name !== "Trollblood Elixir" ||
    !trollblood.requirements.some(
      (requirement) => requirement.itemName === "Troll Blood",
    )
  ) {
    throw new Error("Trollblood Elixir must consume Troll Blood");
  }

  for (const item of ALCHEMY_ITEMS) await assertRgbaSprite(item.sprite);
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const notes: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const dependencyNames = Object.keys(ALCHEMY_HERB_TYPES);
      const dependencies = await tx.item.findMany({
        where: { name: { in: dependencyNames } },
        select: { id: true, name: true, itemType: true },
      });
      const itemIds = new Map<string, number>();
      for (const [name, expectedType] of Object.entries(ALCHEMY_HERB_TYPES)) {
        const matches = dependencies.filter((item) => item.name === name);
        if (matches.length !== 1 || matches[0]?.itemType !== expectedType) {
          throw new Error(
            `${name}: expected exactly one existing ${expectedType} item (run db:seed:gathering first)`,
          );
        }
        itemIds.set(name, matches[0].id);
      }

      const itemNames = ALCHEMY_ITEMS.map((item) => item.name);
      const itemSprites = ALCHEMY_ITEMS.map((item) => item.sprite);
      const existingItems = await tx.item.findMany({
        where: {
          OR: [
            { name: { in: [...itemNames, "Health Potion"] } },
            { sprite: { in: itemSprites } },
          ],
        },
        include: {
          stats: { select: { id: true } },
          foodEffectStats: { select: { id: true } },
          statProgressions: { select: { id: true } },
          statRarityOverrides: { select: { id: true } },
        },
      });

      for (const definition of ALCHEMY_ITEMS) {
        const nameMatches = existingItems.filter(
          (item) => item.name === definition.name,
        );
        const spriteMatches = existingItems.filter(
          (item) => item.sprite === definition.sprite,
        );
        const legacyMatches =
          definition.name === "Minor Healing Potion"
            ? existingItems.filter((item) => item.name === "Health Potion")
            : [];
        const candidateIds = new Set(
          [...nameMatches, ...spriteMatches, ...legacyMatches].map(
            (item) => item.id,
          ),
        );
        if (
          nameMatches.length > 1 ||
          spriteMatches.length > 1 ||
          candidateIds.size > 1 ||
          (spriteMatches[0] &&
            spriteMatches[0].name !== definition.name &&
            spriteMatches[0].name !== "Health Potion")
        ) {
          throw new Error(`Conflicting item template for ${definition.name}`);
        }

        const found =
          nameMatches[0] ?? spriteMatches[0] ?? legacyMatches[0] ?? null;
        const expected = alchemyItemCreateData(definition);
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expected as unknown as Record<string, unknown>,
            )
          : Object.keys(expected);
        const isHealingConsumable =
          definition.itemType === "POTION" || definition.itemType === "ELIXIR";
        const hasLegacyBalance =
          isHealingConsumable &&
          Boolean(
            found &&
              (found.stats.length > 0 ||
                found.foodEffectStats.length > 0 ||
                found.statProgressions.length > 0 ||
                found.statRarityOverrides.length > 0),
          );

        if (
          selectedMode === "--verify" &&
          (!found || differences.length > 0 || hasLegacyBalance)
        ) {
          throw new Error(
            `${definition.name}: item differs (${
              [
                ...differences,
                ...(hasLegacyBalance ? ["legacy stat rows"] : []),
              ].join(", ") || "missing"
            })`,
          );
        }

        let itemId = found?.id ?? null;
        if (selectedMode === "--apply") {
          const written = found
            ? await tx.item.update({ where: { id: found.id }, data: expected })
            : await tx.item.create({ data: expected });
          itemId = written.id;

          if (isHealingConsumable) {
            await Promise.all([
              tx.itemStat.deleteMany({ where: { itemId } }),
              tx.foodEffectStat.deleteMany({ where: { itemId } }),
              tx.itemStatProgression.deleteMany({ where: { itemId } }),
              tx.itemStatRarityOverride.deleteMany({ where: { itemId } }),
            ]);
          }
        }
        if (itemId) itemIds.set(definition.name, itemId);
        notes.push(
          `${definition.name}: ${
            selectedMode === "--apply"
              ? found
                ? found.name === "Health Potion"
                  ? "renamed and updated"
                  : "updated"
                : "created"
              : found && differences.length === 0 && !hasLegacyBalance
                ? "ready"
                : "would write"
          }`,
        );
      }

      const alchemySkill = {
        skill_name: "Alchemy",
        description:
          "Refine gathered herbs, water, monster reagents and rare materials into restorative potions and specialized preparations.",
        category: "CRAFTING" as const,
      };
      const foundAlchemySkill = await tx.skills.findUnique({
        where: { skill_name: alchemySkill.skill_name },
      });
      if (
        selectedMode === "--verify" &&
        (!foundAlchemySkill ||
          foundAlchemySkill.description !== alchemySkill.description ||
          foundAlchemySkill.category !== alchemySkill.category)
      ) {
        throw new Error("Alchemy skill is missing or differs");
      }
      if (selectedMode === "--apply") {
        await tx.skills.upsert({
          where: { skill_name: alchemySkill.skill_name },
          create: alchemySkill,
          update: {
            description: alchemySkill.description,
            category: alchemySkill.category,
          },
        });
      }
      notes.push(
        `Alchemy skill: ${
          selectedMode === "--apply"
            ? foundAlchemySkill
              ? "updated"
              : "created"
            : foundAlchemySkill
              ? "ready"
              : "would create"
        }`,
      );

      const locations = await tx.location.findMany({
        select: { id: true, name: true },
        orderBy: [{ id: "asc" }],
      });
      if (locations.length === 0) {
        throw new Error("At least one location is required for Alchemy");
      }

      for (const potion of ALCHEMY_POTIONS) {
        const outputItemId = itemIds.get(potion.name);
        const requirementRows = potion.requirements.flatMap((requirement) => {
          const itemId = itemIds.get(requirement.itemName);
          return itemId
            ? [{ itemId, quantityPerUnit: requirement.quantityPerUnit }]
            : [];
        });
        if (
          !outputItemId ||
          requirementRows.length !== potion.requirements.length
        ) {
          if (selectedMode === "--check") {
            notes.push(`${potion.name}: would configure Alchemy recipe`);
            continue;
          }
          throw new Error(`${potion.name}: missing output or ingredient`);
        }

        const expectedResource = {
          actionType: "ALCHEMY" as const,
          name: potion.name,
          itemId: outputItemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: potion.requiredSkillLevel,
          defaultSeconds: potion.defaultSeconds,
          yieldPerUnit: 1,
          xpPerUnit: potion.xpPerUnit,
          rarity: potion.rarity,
          sortOrder: potion.sortOrder,
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
        if (found && found.actionType !== "ALCHEMY") {
          throw new Error(
            `${potion.name} already belongs to ${found.actionType}`,
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
        const enabledLocationIds = new Set(
          found?.locations
            .filter((location) => location.enabled)
            .map((location) => location.locationId) ?? [],
        );
        const locationsMatch =
          enabledLocationIds.size === locations.length &&
          locations.every((location) => enabledLocationIds.has(location.id));

        if (
          selectedMode === "--verify" &&
          (!found ||
            differences.length > 0 ||
            !requirementsMatch ||
            !locationsMatch)
        ) {
          throw new Error(`${potion.name}: Alchemy recipe differs`);
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
          `${potion.name}: ${
            selectedMode === "--apply"
              ? found
                ? "updated"
                : "created"
              : found &&
                  differences.length === 0 &&
                  requirementsMatch &&
                  locationsMatch
                ? "ready"
                : "would configure"
          }`,
        );
      }

      // Water is a mundane reagent, intentionally offered by every active NPC
      // rather than being placed in a rare gathering table. Existing custom
      // water offers are preserved; this only fills gaps.
      const waterItemId = itemIds.get("Water");
      if (!waterItemId) {
        if (selectedMode !== "--check") {
          throw new Error("Water item was not created");
        }
        notes.push(
          "Water vendor stock: would configure after Water is created",
        );
      } else {
        const vendors = await tx.npc.findMany({
          where: { enabled: true },
          select: { id: true, name: true },
        });
        if (vendors.length === 0) {
          notes.push("Water vendor stock: no active NPCs yet");
        } else {
          const waterOffers = await tx.npcOffer.findMany({
            where: {
              itemId: waterItemId,
              npcId: { in: vendors.map((npc) => npc.id) },
            },
            select: { npcId: true, enabled: true },
          });
          const vendorsWithWater = new Set(
            waterOffers
              .filter((offer) => offer.enabled)
              .map((offer) => offer.npcId),
          );
          const missingVendors = vendors.filter(
            (vendor) => !vendorsWithWater.has(vendor.id),
          );
          if (selectedMode === "--verify" && missingVendors.length > 0) {
            throw new Error(
              `Water is not for sale from: ${missingVendors.map((vendor) => vendor.name).join(", ")}`,
            );
          }
          if (selectedMode === "--apply" && missingVendors.length > 0) {
            await tx.npcOffer.createMany({
              data: missingVendors.map((vendor) => ({
                npcId: vendor.id,
                itemId: waterItemId,
                price: 3,
                enabled: true,
                sortOrder: 90,
              })),
            });
          }
          notes.push(
            `Water vendor stock: ${
              selectedMode === "--apply"
                ? `${missingVendors.length} offer${missingVendors.length === 1 ? "" : "s"} added`
                : missingVendors.length === 0
                  ? "ready"
                  : `${missingVendors.length} offer${missingVendors.length === 1 ? "" : "s"} needed`
            }`,
          );
        }
      }

      notes.push(
        "Troll Blood source: rare Stoneback Troll drop configured by db:seed:dungeons",
      );
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${selectedMode.slice(2)} complete: ${ALCHEMY_POTIONS.length} healing recipes, ${Object.keys(ALCHEMY_HERB_TYPES).length} gathered herbs, Water vendor stock, and Troll Blood support.`,
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
