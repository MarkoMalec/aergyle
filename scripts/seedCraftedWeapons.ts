import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import type { ItemType } from "../src/generated/prisma/enums";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  CRAFTED_WEAPON_DEPENDENCY_TYPES,
  CRAFTED_WEAPON_SKILL_OUTPUTS,
  CRAFTED_WEAPONS,
  EXISTING_WEAPON_CRAFTS,
  craftedWeaponCreateData,
  type CraftedWeaponDefinition,
  type ExistingWeaponCraftDefinition,
  type WeaponCraftSkill,
} from "../prisma/content/craftedWeapons";
import {
  getResourceSkillConflict,
  sortItemTypes,
  type SkillItemRules,
} from "../src/game/crafting";
import { toSkillNameFromActionType } from "../src/utils/vocations";
import { changedFields, sameRequirements } from "./seedHelpers";

type Mode = "--check" | "--apply" | "--verify";

const mode = process.argv[2] ?? "--check";
if (
  !(mode === "--check" || mode === "--apply" || mode === "--verify") ||
  process.argv.length > 3
) {
  throw new Error(
    "Usage: npm run db:seed:weapons -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

const WEAPONS: readonly CraftedWeaponDefinition[] = CRAFTED_WEAPONS;
const EXISTING: readonly ExistingWeaponCraftDefinition[] =
  EXISTING_WEAPON_CRAFTS;

type Craft = ExistingWeaponCraftDefinition;

/** Every recipe in the pack, in the order new recipes are listed in-game. */
function allCrafts(): Craft[] {
  const crafts: Craft[] = [
    ...WEAPONS.map((item) => ({
      itemName: item.name,
      itemType: item.itemType,
      rarity: item.rarity,
      craft: item.craft,
    })),
    ...EXISTING,
  ];
  const typeOrder = [...new Set(WEAPONS.map((item) => item.itemType))];
  return crafts.sort(
    (a, b) =>
      a.craft.actionType.localeCompare(b.craft.actionType) ||
      typeOrder.indexOf(a.itemType) - typeOrder.indexOf(b.itemType) ||
      a.craft.requiredSkillLevel - b.craft.requiredSkillLevel,
  );
}

async function validateDefinitions() {
  for (const key of ["name", "sprite"] as const) {
    if (new Set(WEAPONS.map((item) => item[key])).size !== WEAPONS.length) {
      throw new Error(`Crafted weapon ${key}s must be unique`);
    }
  }
  const names = allCrafts().map((craft) => craft.itemName);
  if (new Set(names).size !== names.length) {
    throw new Error("Every weapon may have only one recipe");
  }

  for (const item of WEAPONS) {
    if (item.craft.requiredSkillLevel !== item.requiredLevel) {
      throw new Error(`${item.name}: craft level must equal its equip level`);
    }
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

  for (const { itemName, craft } of allCrafts()) {
    for (const requirement of craft.requirements) {
      if (!(requirement.itemName in CRAFTED_WEAPON_DEPENDENCY_TYPES)) {
        throw new Error(
          `${itemName}: unknown material ${requirement.itemName}`,
        );
      }
    }
  }
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const notes: string[] = [];
  const note = (subject: string, wrote: string, ready: boolean) =>
    notes.push(
      `${subject}: ${selectedMode === "--apply" ? wrote : ready ? "ready" : "would write"}`,
    );

  await prisma.$transaction(
    async (tx) => {
      // Materials and the weapons that only gain a recipe must already exist.
      const expectedTypes = new Map<string, ItemType>([
        ...Object.entries(CRAFTED_WEAPON_DEPENDENCY_TYPES),
        ...EXISTING.map(
          (craft) => [craft.itemName, craft.itemType] as [string, ItemType],
        ),
      ]);
      const knownItems = await tx.item.findMany({
        where: { name: { in: [...expectedTypes.keys()] } },
        select: { id: true, name: true, itemType: true, rarity: true },
      });
      const itemIds = new Map<string, number>();
      for (const [name, itemType] of expectedTypes) {
        const matches = knownItems.filter((item) => item.name === name);
        if (matches.length !== 1 || matches[0]?.itemType !== itemType) {
          throw new Error(
            `${name}: expected exactly one existing ${itemType} item`,
          );
        }
        itemIds.set(name, matches[0].id);
      }
      for (const craft of EXISTING) {
        const found = knownItems.find((item) => item.name === craft.itemName);
        if (found?.rarity !== craft.rarity) {
          throw new Error(
            `${craft.itemName}: expected a ${craft.rarity} template`,
          );
        }
      }

      // Pack-owned weapon templates.
      const existingItems = await tx.item.findMany({
        where: {
          OR: [
            { name: { in: WEAPONS.map((item) => item.name) } },
            { sprite: { in: WEAPONS.map((item) => item.sprite) } },
          ],
        },
        include: { stats: true },
      });
      for (const definition of WEAPONS) {
        const nameMatches = existingItems.filter(
          (item) => item.name === definition.name,
        );
        const spriteMatches = existingItems.filter(
          (item) => item.sprite === definition.sprite,
        );
        if (
          nameMatches.length > 1 ||
          spriteMatches.length > 1 ||
          new Set([...nameMatches, ...spriteMatches].map((item) => item.id))
            .size > 1 ||
          (spriteMatches[0] && spriteMatches[0].name !== definition.name)
        ) {
          throw new Error(`Conflicting item template for ${definition.name}`);
        }

        const found = nameMatches[0] ?? spriteMatches[0] ?? null;
        const fullData = craftedWeaponCreateData(definition);
        const { stats: _stats, ...scalarData } = fullData;
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              scalarData as unknown as Record<string, unknown>,
            )
          : Object.keys(scalarData);
        const statsMatch =
          found?.stats.length === definition.stats.length &&
          definition.stats.every((expected) =>
            found.stats.some(
              (stat) =>
                stat.statType === expected.statType &&
                stat.value === expected.value &&
                stat.maxValue === (expected.maxValue ?? null),
            ),
          );
        if (
          selectedMode === "--verify" &&
          (!found || differences.length > 0 || !statsMatch)
        ) {
          throw new Error(
            `${definition.name}: item differs (${differences.join(", ") || (found ? "stats" : "missing")})`,
          );
        }

        let itemId = found?.id ?? null;
        if (selectedMode === "--apply") {
          if (found) {
            await tx.item.update({ where: { id: found.id }, data: scalarData });
            await tx.itemStat.deleteMany({ where: { itemId: found.id } });
            await tx.itemStat.createMany({
              data: definition.stats.map((stat) => ({
                itemId: found.id,
                statType: stat.statType,
                value: stat.value,
                maxValue: stat.maxValue ?? null,
              })),
            });
          } else {
            itemId = (await tx.item.create({ data: fullData })).id;
          }
        }
        if (itemId) itemIds.set(definition.name, itemId);
        note(
          definition.name,
          found ? "updated" : "created",
          !!found && differences.length === 0 && statsMatch,
        );
      }

      // Skill rules: add the output types this pack needs, keep the rest.
      const ruleRows = await tx.vocationalSkillRule.findMany();
      const rules: SkillItemRules = {};
      for (const row of ruleRows) {
        rules[row.actionType] = {
          outputTypes: row.outputItemTypes as unknown as ItemType[],
          inputTypes: row.inputItemTypes as unknown as ItemType[],
        };
      }
      for (const [actionType, needed] of Object.entries(
        CRAFTED_WEAPON_SKILL_OUTPUTS,
      ) as Array<[WeaponCraftSkill, readonly ItemType[]]>) {
        const rule = rules[actionType];
        // No row, or an empty list, already accepts every type.
        if (!rule || rule.outputTypes.length === 0) continue;
        const missing = needed.filter(
          (type) => !rule.outputTypes.includes(type),
        );
        if (selectedMode === "--verify" && missing.length > 0) {
          throw new Error(
            `${actionType} skill rule can't output ${missing.join(", ")}`,
          );
        }
        rule.outputTypes = sortItemTypes([...rule.outputTypes, ...missing]);
        if (selectedMode === "--apply" && missing.length > 0) {
          await tx.vocationalSkillRule.update({
            where: { actionType },
            data: { outputItemTypes: rule.outputTypes },
          });
        }
        note(
          `${actionType} skill rule`,
          missing.length > 0
            ? `now outputs ${missing.join(", ")}`
            : "unchanged",
          missing.length === 0,
        );
      }

      const skillNames = [
        ...new Set(allCrafts().map(({ craft }) => craft.actionType)),
      ].map(toSkillNameFromActionType);
      const skills = await tx.skills.findMany({
        where: { skill_name: { in: skillNames } },
      });
      for (const skillName of skillNames) {
        if (!skills.some((skill) => skill.skill_name === skillName)) {
          throw new Error(
            `${skillName} skill is missing; run npm run db:seed:armor-sets -- --apply first`,
          );
        }
      }

      // Recipes, available at every location like the other crafts.
      const locations = await tx.location.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (locations.length === 0) {
        throw new Error("At least one location is required for crafting");
      }
      const nextSortOrder = new Map<WeaponCraftSkill, number>();
      for (const actionType of new Set(
        allCrafts().map(({ craft }) => craft.actionType),
      )) {
        const last = await tx.vocationalResource.aggregate({
          where: { actionType },
          _max: { sortOrder: true },
        });
        nextSortOrder.set(actionType, (last._max.sortOrder ?? 0) + 10);
      }

      for (const { itemName, itemType, rarity, craft } of allCrafts()) {
        const conflict = getResourceSkillConflict({
          actionType: craft.actionType,
          outputType: itemType,
          requirementTypes: craft.requirements.map(
            (requirement) =>
              CRAFTED_WEAPON_DEPENDENCY_TYPES[
                requirement.itemName as keyof typeof CRAFTED_WEAPON_DEPENDENCY_TYPES
              ],
          ),
          hasRecipeGate: false,
          itemRules: rules,
        });
        if (conflict) throw new Error(`${itemName}: ${conflict}`);

        const outputItemId = itemIds.get(itemName);
        if (!outputItemId) {
          if (selectedMode === "--check") {
            notes.push(`${itemName}: would create ${craft.actionType} recipe`);
            continue;
          }
          throw new Error(`${itemName}: missing output item`);
        }
        const requirementRows = craft.requirements.map((requirement) => ({
          itemId: itemIds.get(requirement.itemName)!,
          quantityPerUnit: requirement.quantityPerUnit,
        }));
        const expectedResource = {
          actionType: craft.actionType,
          name: itemName,
          itemId: outputItemId,
          requiredRecipeItemId: null,
          requiredSkillLevel: craft.requiredSkillLevel,
          defaultSeconds: craft.defaultSeconds,
          yieldPerUnit: 1,
          xpPerUnit: craft.xpPerUnit,
          rarity,
        };
        const found = await tx.vocationalResource.findUnique({
          where: { itemId: outputItemId },
          include: {
            requirements: { select: { itemId: true, quantityPerUnit: true } },
            locations: { select: { locationId: true, enabled: true } },
          },
        });
        if (found && found.actionType !== craft.actionType) {
          throw new Error(`${itemName} already belongs to ${found.actionType}`);
        }
        const differences = found
          ? changedFields(
              found as unknown as Record<string, unknown>,
              expectedResource as unknown as Record<string, unknown>,
            )
          : Object.keys(expectedResource);
        const enabledLocations = new Set(
          found?.locations
            .filter((location) => location.enabled)
            .map((location) => location.locationId) ?? [],
        );
        const ready =
          !!found &&
          differences.length === 0 &&
          sameRequirements(found.requirements, requirementRows) &&
          locations.every((location) => enabledLocations.has(location.id));
        if (selectedMode === "--verify" && !ready) {
          throw new Error(`${itemName}: crafting recipe differs`);
        }

        if (selectedMode === "--apply") {
          // sortOrder is admin-managed on /admin/vocations: set it only once.
          const sortOrder = nextSortOrder.get(craft.actionType)!;
          const resource = await tx.vocationalResource.upsert({
            where: { itemId: outputItemId },
            create: { ...expectedResource, sortOrder },
            update: expectedResource,
          });
          if (!found) nextSortOrder.set(craft.actionType, sortOrder + 10);
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
        note(
          `${itemName} recipe`,
          `${craft.actionType} ${craft.requiredSkillLevel} configured`,
          ready,
        );
      }
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  console.table(notes.map((result) => ({ result })));
  console.log(
    `${mode.slice(2)} complete: ${WEAPONS.length} weapon templates, ${allCrafts().length} recipes.`,
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
