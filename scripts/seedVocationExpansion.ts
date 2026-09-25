import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  VOCATION_BASELINE_RESOURCES,
  VOCATION_DEPENDENCY_ITEMS,
  VOCATION_EXPANSION,
  VOCATION_EXPANSION_LOCATIONS,
  vocationItemCreateData,
  vocationSpritePath,
} from "../prisma/content/vocationExpansion";
import { changedFields } from "./seedHelpers";

const mode = process.argv[2] ?? "--check";
if (
  !["--check", "--apply", "--verify"].includes(mode) ||
  process.argv.length > 3
) {
  throw new Error(
    "Usage: npm run db:seed:vocations -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

type Mode = "--check" | "--apply" | "--verify";
type ResultRow = {
  kind: "dependency" | "location" | "resource";
  name: string;
  action: string;
};

async function validateSprites() {
  for (const definition of VOCATION_EXPANSION) {
    const png = await readFile(
      new URL(`../public${vocationSpritePath(definition)}`, import.meta.url),
    );
    if (
      png.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== 256 ||
      png.readUInt32BE(20) !== 256 ||
      png[25] !== 6
    ) {
      throw new Error(`${definition.slug}: expected a 256×256 RGBA PNG sprite`);
    }
  }
}

async function main(selectedMode: Mode) {
  await validateSprites();

  const results = await prisma.$transaction(
    async (tx) => {
      const rows: ResultRow[] = [];

      const allItemNames = [
        ...VOCATION_DEPENDENCY_ITEMS.map((item) => item.name),
        ...VOCATION_EXPANSION.map((item) => item.name),
      ];
      const allSpritePaths = [
        ...VOCATION_DEPENDENCY_ITEMS.map((item) => item.sprite),
        ...VOCATION_EXPANSION.map(vocationSpritePath),
      ];
      const existingItems = await tx.item.findMany({
        where: {
          OR: [
            { name: { in: allItemNames } },
            { sprite: { in: allSpritePaths } },
          ],
        },
      });

      const itemsByName = new Map(
        existingItems.map((item) => [item.name, item]),
      );

      for (const dependency of VOCATION_DEPENDENCY_ITEMS) {
        const matches = existingItems.filter(
          (item) =>
            item.name === dependency.name || item.sprite === dependency.sprite,
        );
        const found = matches[0];
        if (
          matches.length > 1 ||
          (found &&
            (found.name !== dependency.name ||
              found.sprite !== dependency.sprite ||
              found.itemType !== dependency.itemType))
        ) {
          throw new Error(
            `Conflicting dependency item for ${dependency.name}; nothing was imported.`,
          );
        }

        if (!found && selectedMode === "--verify") {
          throw new Error(`Missing dependency item: ${dependency.name}`);
        }
        if (!found && selectedMode === "--apply") {
          const created = await tx.item.create({
            data: {
              ...dependency,
              equipTo: null,
              stackable: true,
              maxStackSize: 9999,
              requiredLevel: 1,
            },
          });
          itemsByName.set(created.name, created);
          rows.push({
            kind: "dependency",
            name: created.name,
            action: "created",
          });
        } else {
          rows.push({
            kind: "dependency",
            name: dependency.name,
            action: found ? "kept" : "would create",
          });
        }
      }

      for (const definition of VOCATION_EXPANSION) {
        const expected = vocationItemCreateData(definition);
        const sprite = vocationSpritePath(definition);
        const matches = existingItems.filter(
          (item) => item.name === definition.name || item.sprite === sprite,
        );
        const found = matches[0];
        if (
          matches.length > 1 ||
          (found && (found.name !== definition.name || found.sprite !== sprite))
        ) {
          throw new Error(
            `Conflicting item for ${definition.name}; nothing was imported.`,
          );
        }

        const differences = found
          ? changedFields(found, expected as Record<string, unknown>)
          : [];
        if (selectedMode === "--verify") {
          if (!found) throw new Error(`Missing item: ${definition.name}`);
          if (differences.length > 0) {
            throw new Error(
              `${definition.name}: item fields differ (${differences.join(", ")})`,
            );
          }
        }

        if (!found && selectedMode === "--apply") {
          const created = await tx.item.create({ data: expected });
          itemsByName.set(created.name, created);
          rows.push({
            kind: "resource",
            name: created.name,
            action: "item created",
          });
        } else if (
          found &&
          differences.length > 0 &&
          selectedMode === "--apply"
        ) {
          const updated = await tx.item.update({
            where: { id: found.id },
            data: expected,
          });
          itemsByName.set(updated.name, updated);
          rows.push({
            kind: "resource",
            name: updated.name,
            action: "item updated",
          });
        } else {
          rows.push({
            kind: "resource",
            name: definition.name,
            action:
              selectedMode === "--verify"
                ? "verified"
                : found
                  ? differences.length > 0
                    ? "would update item"
                    : "item kept"
                  : "would create item",
          });
        }
      }

      const locationsByName = new Map(
        (
          await tx.location.findMany({
            where: {
              name: {
                in: VOCATION_EXPANSION_LOCATIONS.map((item) => item.name),
              },
            },
          })
        ).map((location) => [location.name, location]),
      );

      for (const definition of VOCATION_EXPANSION_LOCATIONS) {
        const found = locationsByName.get(definition.name);
        if (selectedMode === "--verify") {
          if (!found) throw new Error(`Missing location: ${definition.name}`);
          if (found.requiredLevel !== definition.requiredLevel) {
            throw new Error(`${definition.name}: requiredLevel differs`);
          }
        }

        if (!found && selectedMode === "--apply") {
          const created = await tx.location.create({ data: definition });
          locationsByName.set(created.name, created);
          rows.push({
            kind: "location",
            name: created.name,
            action: "created",
          });
        } else if (
          found &&
          found.requiredLevel !== definition.requiredLevel &&
          selectedMode === "--apply"
        ) {
          const updated = await tx.location.update({
            where: { id: found.id },
            data: { requiredLevel: definition.requiredLevel },
          });
          locationsByName.set(updated.name, updated);
          rows.push({
            kind: "location",
            name: updated.name,
            action: "level updated",
          });
        } else {
          rows.push({
            kind: "location",
            name: definition.name,
            action:
              selectedMode === "--verify"
                ? "verified"
                : found
                  ? "kept"
                  : "would create",
          });
        }
      }

      if (selectedMode !== "--check") {
        for (const baseline of VOCATION_BASELINE_RESOURCES) {
          const item = itemsByName.get(baseline.itemName);
          const citadel = locationsByName.get("Citadel");
          if (!item || !citadel) {
            throw new Error(
              `Cannot configure baseline resource ${baseline.name}`,
            );
          }
          let resource = await tx.vocationalResource.findUnique({
            where: { itemId: item.id },
          });
          if (!resource && selectedMode === "--verify") {
            throw new Error(`Missing baseline resource: ${baseline.name}`);
          }
          if (!resource && selectedMode === "--apply") {
            resource = await tx.vocationalResource.create({
              data: {
                actionType: baseline.actionType,
                name: baseline.name,
                itemId: item.id,
                requiredSkillLevel: baseline.requiredSkillLevel,
                defaultSeconds: baseline.defaultSeconds,
                yieldPerUnit: baseline.yieldPerUnit,
                xpPerUnit: baseline.xpPerUnit,
                rarity: baseline.rarity,
              },
            });
          }
          if (resource) {
            const link = await tx.locationVocationalResource.findUnique({
              where: {
                locationId_resourceId: {
                  locationId: citadel.id,
                  resourceId: resource.id,
                },
              },
            });
            if (selectedMode === "--verify" && link?.enabled !== true) {
              throw new Error(`${baseline.name}: not enabled at Citadel`);
            }
            if (selectedMode === "--apply") {
              await tx.locationVocationalResource.upsert({
                where: {
                  locationId_resourceId: {
                    locationId: citadel.id,
                    resourceId: resource.id,
                  },
                },
                create: {
                  locationId: citadel.id,
                  resourceId: resource.id,
                  enabled: true,
                },
                update: { enabled: true },
              });
            }
          }
        }
      }

      if (selectedMode !== "--check") {
        for (const definition of VOCATION_EXPANSION) {
          const item = itemsByName.get(definition.name);
          if (!item) throw new Error(`Missing item: ${definition.name}`);

          const expectedResource = {
            actionType: definition.actionType,
            name: definition.name,
            itemId: item.id,
            requiredSkillLevel: definition.requiredSkillLevel,
            defaultSeconds: definition.defaultSeconds,
            yieldPerUnit: definition.yieldPerUnit,
            xpPerUnit: definition.xpPerUnit,
            rarity: definition.rarity,
          };
          let resource = await tx.vocationalResource.findUnique({
            where: { itemId: item.id },
            include: {
              requirements: { include: { item: true } },
              locations: { include: { location: true } },
            },
          });

          if (selectedMode === "--verify") {
            if (!resource)
              throw new Error(`Missing resource: ${definition.name}`);
            const differences = changedFields(
              resource,
              expectedResource as Record<string, unknown>,
            );
            if (differences.length > 0) {
              throw new Error(
                `${definition.name}: resource fields differ (${differences.join(", ")})`,
              );
            }

            const actualRequirements = resource.requirements
              .map((requirement) => ({
                itemName: requirement.item.name,
                quantityPerUnit: requirement.quantityPerUnit,
              }))
              .sort((a, b) => a.itemName.localeCompare(b.itemName));
            const expectedRequirements = [...definition.requirements].sort(
              (a, b) => a.itemName.localeCompare(b.itemName),
            );
            if (
              JSON.stringify(actualRequirements) !==
              JSON.stringify(expectedRequirements)
            ) {
              throw new Error(`${definition.name}: requirements differ`);
            }

            const actualLocations = resource.locations
              .filter((link) => link.enabled)
              .map((link) => link.location.name)
              .sort();
            const expectedLocations = [...definition.locations].sort();
            if (
              JSON.stringify(actualLocations) !==
              JSON.stringify(expectedLocations)
            ) {
              throw new Error(`${definition.name}: locations differ`);
            }
          } else if (resource) {
            resource = await tx.vocationalResource.update({
              where: { id: resource.id },
              data: expectedResource,
              include: {
                requirements: { include: { item: true } },
                locations: { include: { location: true } },
              },
            });
          } else {
            resource = await tx.vocationalResource.create({
              data: expectedResource,
              include: {
                requirements: { include: { item: true } },
                locations: { include: { location: true } },
              },
            });
          }

          if (selectedMode === "--apply") {
            await tx.vocationalRequirement.deleteMany({
              where: { resourceId: resource.id },
            });
            if (definition.requirements.length > 0) {
              await tx.vocationalRequirement.createMany({
                data: definition.requirements.map((requirement) => {
                  const requiredItem = itemsByName.get(requirement.itemName);
                  if (!requiredItem) {
                    throw new Error(
                      `${definition.name}: missing input ${requirement.itemName}`,
                    );
                  }
                  return {
                    resourceId: resource.id,
                    itemId: requiredItem.id,
                    quantityPerUnit: requirement.quantityPerUnit,
                  };
                }),
              });
            }

            await tx.locationVocationalResource.deleteMany({
              where: { resourceId: resource.id },
            });
            await tx.locationVocationalResource.createMany({
              data: definition.locations.map((locationName) => {
                const location = locationsByName.get(locationName);
                if (!location) {
                  throw new Error(
                    `${definition.name}: missing location ${locationName}`,
                  );
                }
                return {
                  locationId: location.id,
                  resourceId: resource.id,
                  enabled: true,
                };
              }),
            });
          }
        }
      }

      return rows;
    },
    { isolationLevel: "Serializable", timeout: 60_000 },
  );

  console.table(results);
  console.log(
    `${VOCATION_EXPANSION.length} new resources and ${VOCATION_EXPANSION_LOCATIONS.length} atlas locations. Mode: ${selectedMode}.`,
  );
}

try {
  await main(mode as Mode);
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
