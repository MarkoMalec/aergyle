/**
 * One-off: scales every creature's health and damage by one factor, used
 * after the 2026-11 rarity multiplier nerf (Rare 1.35 -> 1.15) made gear
 * weaker against monsters. Armor, evasion and resistances are untouched:
 * they are shares of the player's armor constant, not of gear power.
 *
 *   node --import tsx scripts/scaleCreatures.ts            # dry run
 *   node --import tsx scripts/scaleCreatures.ts --apply    # backup + write
 *   node --import tsx scripts/scaleCreatures.ts --factor=0.9
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";

const APPLY = process.argv.includes("--apply");
const FACTOR = Number(
  process.argv.find((a) => a.startsWith("--factor="))?.split("=")[1] ?? 0.9,
);
if (!(FACTOR > 0 && FACTOR < 2)) throw new Error(`Bad factor ${FACTOR}`);
const OUT_DIR = new URL("../prisma/rebalance/", import.meta.url);

const FIELDS = [
  "health",
  "damageMin",
  "damageMax",
  "magicDamageMin",
  "magicDamageMax",
  "elementalDamageMin",
  "elementalDamageMax",
] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, number>;

/** Rounds, keeps non-zero values at least 1 and max at least min. */
export function scale(v: Values, factor: number): Values {
  const s = (n: number) => (n > 0 ? Math.max(1, Math.round(n * factor)) : n);
  const out = Object.fromEntries(FIELDS.map((f) => [f, s(v[f])])) as Values;
  out.damageMax = Math.max(out.damageMax, out.damageMin);
  out.magicDamageMax = Math.max(out.magicDamageMax, out.magicDamageMin);
  out.elementalDamageMax = Math.max(out.elementalDamageMax, out.elementalDamageMin);
  return out;
}

// Self-check of the rounding rules.
{
  const z = { health: 0, damageMin: 0, damageMax: 0, magicDamageMin: 0, magicDamageMax: 0, elementalDamageMin: 0, elementalDamageMax: 0 };
  const r = scale({ ...z, health: 1000, damageMin: 1, damageMax: 1 }, 0.9);
  if (r.health !== 900 || r.damageMin !== 1 || r.damageMax !== 1 || r.magicDamageMin !== 0)
    throw new Error("scale() self-check failed");
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

async function main() {
  const creatures = await prisma.creature.findMany({
    select: { id: true, name: true, kind: true, ...Object.fromEntries(FIELDS.map((f) => [f, true])) },
    orderBy: { id: "asc" },
  });
  const changes = creatures
    .map((c) => ({ c, next: scale(c as unknown as Values, FACTOR) }))
    .filter(({ c, next }) => FIELDS.some((f) => next[f] !== (c as unknown as Values)[f]));

  console.log(`Factor ${FACTOR}: ${changes.length} of ${creatures.length} creatures change.\n`);
  for (const { c, next } of changes) {
    const v = c as unknown as Values;
    console.log(
      `${c.name.padEnd(28)} ${String(c.kind).padEnd(8)} hp ${v.health} -> ${next.health}` +
        `  dmg ${v.damageMin}-${v.damageMax} -> ${next.damageMin}-${next.damageMax}` +
        (v.magicDamageMax ? `  mag ${v.magicDamageMin}-${v.magicDamageMax} -> ${next.magicDamageMin}-${next.magicDamageMax}` : "") +
        (v.elementalDamageMax ? `  ele ${v.elementalDamageMin}-${v.elementalDamageMax} -> ${next.elementalDamageMin}-${next.elementalDamageMax}` : ""),
    );
  }
  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to back up and write.");
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const backupUrl = new URL(`backup-creatures-${Date.now()}.json`, OUT_DIR);
  writeFileSync(backupUrl, JSON.stringify(changes.map(({ c }) => c), null, 2));
  console.log(`\nBackup written to ${backupUrl.pathname}`);

  await prisma.$transaction(
    changes.map(({ c, next }) => prisma.creature.update({ where: { id: c.id }, data: next })),
  );
  console.log(`Updated ${changes.length} creatures.`);
}

main().finally(() => prisma.$disconnect());
