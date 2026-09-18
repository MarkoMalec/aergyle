import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { toTravelRoutePair } from "../src/game/world/travel";
import { ATLAS_TRAVEL_ROUTES } from "../prisma/content/travel";

type Mode = "--check" | "--apply";
const mode = (process.argv[2] ?? "--check") as Mode;
if (!["--check", "--apply"].includes(mode)) {
  throw new Error("Usage: npm run db:seed:travel -- [--check|--apply]");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

// Only fills pairs that have no route yet, so times tuned in /admin/travel are
// never overwritten.
async function main() {
  const [locations, existing] = await Promise.all([
    prisma.location.findMany({ select: { id: true, name: true } }),
    prisma.travelRoute.findMany({
      select: { locationAId: true, locationBId: true },
    }),
  ]);
  const idByName = new Map(locations.map((l) => [l.name, l.id]));
  const existingKeys = new Set(
    existing.map((r) => `${r.locationAId}:${r.locationBId}`),
  );

  const missing: {
    locationAId: number;
    locationBId: number;
    seconds: number;
  }[] = [];
  for (const route of ATLAS_TRAVEL_ROUTES) {
    const a = idByName.get(route.a);
    const b = idByName.get(route.b);
    if (a === undefined || b === undefined) {
      console.log(
        `${route.a} ↔ ${route.b}: skipped (location not in database)`,
      );
      continue;
    }
    const pair = toTravelRoutePair(a, b);
    const label = `${route.a} ↔ ${route.b}`;
    if (existingKeys.has(`${pair.locationAId}:${pair.locationBId}`)) {
      console.log(`${label}: ready (kept)`);
      continue;
    }
    missing.push({ ...pair, seconds: route.seconds });
    console.log(
      `${label}: ${mode === "--apply" ? "created" : "would create"} ${route.seconds / 60}m`,
    );
  }

  if (mode === "--apply" && missing.length > 0) {
    await prisma.travelRoute.createMany({ data: missing });
  }
  console.log(
    `${missing.length} route(s) ${mode === "--apply" ? "created" : "missing"}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
