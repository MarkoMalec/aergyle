import { prisma } from "~/lib/prisma";

type CurveType = "exponential" | "power" | "linear";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseIntArg(name: string, fallback: number): number {
  const raw = getArg(name);
  const n = raw == null ? fallback : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function parseFloatArg(name: string, fallback: number): number {
  const raw = getArg(name);
  const n = raw == null ? fallback : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function clampPositiveInt(n: number, fallback: number): number {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function xpRequiredForLevel(params: {
  curve: CurveType;
  level: number;
  base: number;
  growth: number;
  power: number;
  step: number;
}): bigint {
  const { curve, level, base, growth, power, step } = params;

  if (level <= 1) return 0n;

  let required: number;
  switch (curve) {
    case "exponential":
      required = base * Math.pow(growth, level - 2);
      break;
    case "power":
      required = base * Math.pow(level - 1, power);
      break;
    case "linear":
      required = base + step * (level - 2);
      break;
    default:
      required = base;
  }

  const asInt = Math.max(1, Math.floor(required));
  return BigInt(asInt);
}

async function main() {
  const curve = (getArg("type") as CurveType | undefined) ?? "power";
  const maxLevel = clampPositiveInt(parseIntArg("maxLevel", 500), 500);

  // Defaults are intentionally conservative/low for early levels.
  const base = parseFloatArg("base", 5);
  const growth = parseFloatArg("growth", 1.12);
  const power = parseFloatArg("power", 1.5);
  const step = parseIntArg("step", 5);

  const reset = hasFlag("reset");

  if (reset) {
    await prisma.levelXpThreshold.deleteMany({});
  }

  // Level 1 always starts at 0 total XP.
  await prisma.levelXpThreshold.upsert({
    where: { level: 1 },
    update: { xpTotal: 0n },
    create: { level: 1, xpTotal: 0n },
  });

  let cumulative = 0n;

  for (let level = 2; level <= maxLevel; level++) {
    const required = xpRequiredForLevel({
      curve,
      level,
      base,
      growth,
      power,
      step,
    });

    cumulative += required;

    await prisma.levelXpThreshold.upsert({
      where: { level },
      update: { xpTotal: cumulative },
      create: { level, xpTotal: cumulative },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Generated LevelXpThreshold rows for levels 1..${maxLevel} (curve=${curve}).`,
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
