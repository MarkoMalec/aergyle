import "dotenv/config";
import { access } from "node:fs/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  COOKING_NPCS,
  COOKING_VENDOR_STAPLES,
} from "../prisma/content/cookingNpcs";

const mode = process.argv[2] ?? "--check";
if (!(["--check", "--apply", "--verify"] as const).includes(mode as never)) {
  throw new Error(
    "Usage: npm run db:seed:cooking-npcs -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

type Mode = "--check" | "--apply" | "--verify";

async function validateDefinitions() {
  if (COOKING_NPCS.length !== 12) {
    throw new Error(`Expected 12 cooking NPCs, found ${COOKING_NPCS.length}`);
  }
  if (new Set(COOKING_NPCS.map((npc) => npc.name)).size !== COOKING_NPCS.length) {
    throw new Error("Cooking NPC names must be unique");
  }
  if (
    COOKING_VENDOR_STAPLES.length !== 3 ||
    new Set(COOKING_VENDOR_STAPLES).size !== 3
  ) {
    throw new Error("Cooking vendors must have exactly three distinct staples");
  }

  await Promise.all(
    COOKING_NPCS.map((npc) =>
      access(new URL(`../public${npc.portrait}`, import.meta.url)),
    ),
  );
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const rows: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const [settlements, staples, storedNpcs] = await Promise.all([
        tx.settlement.findMany({
          where: { enabled: true },
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        }),
        tx.item.findMany({
          where: { name: { in: [...COOKING_VENDOR_STAPLES] } },
          select: { id: true, name: true, price: true },
        }),
        tx.npc.findMany({
          where: { name: { in: COOKING_NPCS.map((npc) => npc.name) } },
          include: {
            offers: {
              where: { item: { name: { in: [...COOKING_VENDOR_STAPLES] } } },
              select: {
                id: true,
                itemId: true,
                price: true,
                enabled: true,
                sortOrder: true,
                availableFrom: true,
                availableUntil: true,
                requiredProjectId: true,
              },
            },
          },
        }),
      ]);

      if (settlements.length === 0) {
        throw new Error("At least one enabled settlement is required");
      }

      const staplesByName = new Map(staples.map((item) => [item.name, item]));
      for (const staple of COOKING_VENDOR_STAPLES) {
        if (!staplesByName.has(staple)) {
          throw new Error(`Missing cooking vendor staple: ${staple}`);
        }
      }

      const byName = new Map<string, (typeof storedNpcs)[number]>();
      for (const npc of storedNpcs) {
        if (byName.has(npc.name)) {
          throw new Error(`Duplicate cooking NPC name in database: ${npc.name}`);
        }
        byName.set(npc.name, npc);
      }

      for (const [index, definition] of COOKING_NPCS.entries()) {
        const expected = {
          name: definition.name,
          description: definition.description,
          portrait: definition.portrait,
          enabled: true,
          sortOrder: 600 + index,
        };
        const found = byName.get(definition.name);
        const differs =
          !found ||
          found.description !== expected.description ||
          found.portrait !== expected.portrait ||
          !found.enabled ||
          found.sortOrder !== expected.sortOrder;

        if (selectedMode === "--verify" && differs) {
          throw new Error(`${definition.name}: NPC record is missing or differs`);
        }

        const npc =
          selectedMode === "--apply"
            ? found
              ? await tx.npc.update({ where: { id: found.id }, data: expected })
              : await tx.npc.create({
                  data: {
                    ...expected,
                    settlementId: settlements[index % settlements.length]!.id,
                  },
                })
            : found;

        // `create` and `update` return an NPC without relations by default;
        // only the preloaded record carries the existing staple offers. A new
        // NPC starts with none and receives all three below.
        const offers = found?.offers ?? [];
        for (const [offerIndex, stapleName] of COOKING_VENDOR_STAPLES.entries()) {
          const staple = staplesByName.get(stapleName)!;
          const matches = offers.filter((offer) => offer.itemId === staple.id);
          const expectedOffer = {
            price: staple.price,
            enabled: true,
            sortOrder: offerIndex,
            availableFrom: null,
            availableUntil: null,
            requiredProjectId: null,
          };
          const offerDiffers =
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

          if (selectedMode === "--verify" && offerDiffers) {
            throw new Error(`${definition.name}: ${stapleName} offer is missing or differs`);
          }
          if (selectedMode === "--apply" && npc) {
            const primary = matches[0];
            if (primary) {
              await tx.npcOffer.update({
                where: { id: primary.id },
                data: expectedOffer,
              });
              if (matches.length > 1) {
                await tx.npcOffer.deleteMany({
                  where: { id: { in: matches.slice(1).map((offer) => offer.id) } },
                });
              }
            } else {
              await tx.npcOffer.create({
                data: { ...expectedOffer, npcId: npc.id, itemId: staple.id },
              });
            }
          }
        }
        rows.push(
          `${definition.name}: ${selectedMode === "--apply" ? (found ? "updated" : "created") : differs ? "would write" : "ready"}`,
        );
      }
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(rows.map((result) => ({ result })));
  console.log(
    `${selectedMode.slice(2)} complete: ${COOKING_NPCS.length} cooking NPCs, each stocking ${COOKING_VENDOR_STAPLES.join(", ")}.`,
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
