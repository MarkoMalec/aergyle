import "dotenv/config";
import { access } from "node:fs/promises";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const mode = process.argv[2] ?? "--check";
if (!(["--check", "--apply", "--verify"] as const).includes(mode as never)) {
  throw new Error(
    "Usage: node --import tsx scripts/seedElderAnglers.ts -- [--check|--apply|--verify]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

type Mode = "--check" | "--apply" | "--verify";

const ELDER_ANGLERS = [
  {
    name: "Garron Pike",
    description:
      "A heavy, limping river eel-trapper with a flattened nose, scarred cheek and a willow eel trap.",
    portrait: "/assets/npcs/garron-pike-angler-v1.png",
  },
  {
    name: "Tebb Rillhook",
    description:
      "A bow-legged canal angler and tackle mender with repaired spectacles, a reed creel and a wooden hand reel.",
    portrait: "/assets/npcs/tebb-rillhook-angler-v1.png",
  },
  {
    name: "Rusk Fenlock",
    description:
      "A tall, hunched marsh angler who salvages nets with a weathered pole and a guarded eye.",
    portrait: "/assets/npcs/rusk-fenlock-angler-v1.png",
  },
  {
    name: "Branik Cragfoot",
    description:
      "A broad, arthritic ice-hole angler with frostbite scars, a knee brace and a hand auger.",
    portrait: "/assets/npcs/branik-cragfoot-angler-v1.png",
  },
  {
    name: "Lucan Morrow",
    description:
      "A stooped estuary hand-line maker with a cataract, a folding fishing stool and a pearwood line card.",
    portrait: "/assets/npcs/lucan-morrow-angler-v1.png",
  },
  {
    name: "Mavin Broach",
    description:
      "A bent coast angler and crab-line tender who steadies himself with a hooked walking stick.",
    portrait: "/assets/npcs/mavin-broach-angler-v1.png",
  },
  {
    name: "Osric Vale",
    description:
      "A frail retired lake guide with a braced leg, a worn float and a compact cane-fishing rod.",
    portrait: "/assets/npcs/osric-vale-angler-v1.png",
  },
] as const;

async function validateDefinitions() {
  if (ELDER_ANGLERS.length !== 7) {
    throw new Error(
      `Expected seven elder anglers, found ${ELDER_ANGLERS.length}`,
    );
  }
  if (
    new Set(ELDER_ANGLERS.map(({ name }) => name)).size !== ELDER_ANGLERS.length
  ) {
    throw new Error("Elder angler names must be unique");
  }
  await Promise.all(
    ELDER_ANGLERS.map(({ portrait }) =>
      access(new URL(`../public${portrait}`, import.meta.url)),
    ),
  );
}

async function main(selectedMode: Mode) {
  await validateDefinitions();
  const results = await prisma.$transaction(
    async (tx) => {
      const stored = await tx.npc.findMany({
        where: { name: { in: ELDER_ANGLERS.map(({ name }) => name) } },
        select: {
          id: true,
          name: true,
          description: true,
          portrait: true,
          settlementId: true,
          enabled: true,
          sortOrder: true,
        },
      });
      const byName = new Map<string, (typeof stored)[number]>();
      for (const npc of stored) {
        if (byName.has(npc.name)) {
          throw new Error(`Multiple NPC records named ${npc.name}`);
        }
        byName.set(npc.name, npc);
      }

      const rows: string[] = [];
      for (const [index, definition] of ELDER_ANGLERS.entries()) {
        const expected = {
          settlementId: null,
          description: definition.description,
          portrait: definition.portrait,
          professionId: null,
          requiredStageId: null,
          enabled: true,
          sortOrder: 700 + index,
        };
        const found = byName.get(definition.name);
        const differs =
          !found ||
          found.description !== expected.description ||
          found.portrait !== expected.portrait ||
          found.settlementId !== null ||
          !found.enabled ||
          found.sortOrder !== expected.sortOrder;

        if (selectedMode === "--verify" && differs) {
          throw new Error(
            `${definition.name}: NPC record is missing or differs`,
          );
        }
        if (selectedMode === "--apply" && differs) {
          if (found) {
            await tx.npc.update({ where: { id: found.id }, data: expected });
            rows.push(`${definition.name}: updated and left unassigned`);
          } else {
            await tx.npc.create({
              data: { name: definition.name, ...expected },
            });
            rows.push(`${definition.name}: created unassigned`);
          }
        } else {
          rows.push(
            `${definition.name}: ${differs ? "would write unassigned record" : "ready and unassigned"}`,
          );
        }
      }
      return rows;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.table(results.map((result) => ({ result })));
  console.log(
    `${selectedMode.slice(2)} complete: ${ELDER_ANGLERS.length} unassigned elder anglers.`,
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
