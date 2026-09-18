import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  HUNTING_CREATURES,
  HUNTING_DURATIONS,
  HUNTING_GROUNDS,
  HUNTING_ITEMS,
} from "../prisma/content/hunting";
import { WORLD_ATLAS_LOCATION_MARKERS } from "../src/game/world/atlasLocations";
import {
  applyLiveHuntingSafety,
  resolveHuntingExpedition,
  type HuntingResolutionInput,
} from "../src/server/hunting/resolver";
import {
  calculateHealthAfterDamage,
  resolveRegeneratedHealth,
} from "../src/server/combat/healthMath";
import { createExpeditionRandom } from "../src/server/expeditions/random";

const basicPool = [
  {
    creatureId: 1,
    name: "Test Hare",
    asset: "/hare.png",
    encounterWeight: 1,
    attackStyle: "MELEE" as const,
    attackChance: 0,
    damageMin: 0,
    damageMax: 0,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    critChance: 0,
    critDamage: 0,
    drops: [
      {
        dropId: 1,
        itemId: 10,
        name: "Hide",
        sprite: "/hide.png",
        rarity: "COMMON" as const,
        baseChance: 0.2,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        dropId: 2,
        itemId: 11,
        name: "Bone",
        sprite: "/bone.png",
        rarity: "COMMON" as const,
        baseChance: 0.2,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
];

function input(
  overrides: Partial<HuntingResolutionInput> = {},
): HuntingResolutionInput {
  return {
    pool: basicPool,
    encounterRolls: 1,
    quantityMultiplier: 1,
    dangerMultiplier: 1,
    globalDangerMultiplier: 1,
    damageEnabled: true,
    maxHealthLossPercent: 30,
    accidentChance: 0,
    accidentDamageMin: 0,
    accidentDamageMax: 0,
    skillLevel: 1,
    luck: 0,
    huntingEfficiency: 0,
    defenses: {
      armor: 0,
      magicResist: 0,
      evasionMelee: 0,
      evasionRanged: 0,
      evasionMagic: 0,
      blockChance: 0,
      fireResist: 0,
      coldResist: 0,
      lightningResist: 0,
      poisonResist: 0,
      movementSpeed: 100,
      maxHealth: 100,
    },
    random: () => 0.3,
    ...overrides,
  };
}

void test("starter Hunting content covers every world location with selectable grounds", () => {
  const coveredLocations = new Set(
    HUNTING_GROUNDS.map((ground) => ground.locationName),
  );
  for (const location of WORLD_ATLAS_LOCATION_MARKERS) {
    assert.ok(
      coveredLocations.has(location.name),
      `${location.name} needs a hunting ground`,
    );
  }
  for (const ground of HUNTING_GROUNDS) {
    assert.ok(ground.name.length > 0);
    assert.ok(ground.description.length > 0);
    assert.ok(ground.creatures.length > 0);
    assert.ok(ground.accidentChance >= 0 && ground.accidentChance <= 1);
    assert.ok(ground.accidentDamageMax >= ground.accidentDamageMin);
  }
});

void test("every animal has danger settings, an asset, and a valid material table", () => {
  const itemNames = new Set(HUNTING_ITEMS.map((item) => item.name));
  assert.ok(HUNTING_CREATURES.length >= 6);
  for (const creature of HUNTING_CREATURES) {
    assert.match(creature.asset, /^\/assets\/creatures\/animals\//);
    assert.ok(creature.attackChance >= 0 && creature.attackChance <= 1);
    assert.ok(creature.damageMin >= 0);
    assert.ok(creature.damageMax >= creature.damageMin);
    assert.ok(creature.drops.length > 0);
    for (const drop of creature.drops) {
      assert.ok(itemNames.has(drop.itemName as never));
      assert.ok(drop.baseChance > 0 && drop.baseChance <= 1);
      assert.ok(drop.maxQuantity >= drop.minQuantity);
    }
  }
});

void test("skill, Luck, and Hunting Efficiency improve the shared expedition drop formula", () => {
  const baseline = resolveHuntingExpedition(input());
  const improved = resolveHuntingExpedition(
    input({ skillLevel: 51, luck: 50, huntingEfficiency: 60 }),
  );
  assert.equal(
    baseline.rewards.length,
    1,
    "a hunt guarantees one usable carcass material",
  );
  assert.equal(
    improved.rewards.length,
    2,
    "improved chance finds both configured materials",
  );
  assert.ok(
    improved.report.modifiers.findModifierPercent >
      baseline.report.modifiers.findModifierPercent,
  );
});

void test("drop chances stay independent while an entirely empty hunt gets one fallback material", () => {
  const missedHunt = resolveHuntingExpedition(
    input({ encounterRolls: 4, random: () => 0.99 }),
  );
  assert.equal(missedHunt.report.encounters[0]?.count, 4);
  assert.equal(missedHunt.rewards.length, 1);
  assert.equal(missedHunt.rewards[0]?.quantity, 1);
});

void test("a snapshotted seed makes claim retries resolve identically", () => {
  const first = resolveHuntingExpedition(
    input({ encounterRolls: 4, random: createExpeditionRandom("hunt-42") }),
  );
  const retry = resolveHuntingExpedition(
    input({ encounterRolls: 4, random: createExpeditionRandom("hunt-42") }),
  );
  assert.deepEqual(retry, first);
});

void test("evasion, block, and armor each reduce creature retaliation", () => {
  const dangerousPool = [
    {
      ...basicPool[0]!,
      attackChance: 1,
      damageMin: 20,
      damageMax: 20,
    },
  ];
  const unarmored = resolveHuntingExpedition(
    input({ pool: dangerousPool, random: () => 0 }),
  );
  const armored = resolveHuntingExpedition(
    input({
      pool: dangerousPool,
      defenses: { ...input().defenses, armor: 100 },
      random: () => 0,
    }),
  );
  const blocked = resolveHuntingExpedition(
    input({
      pool: dangerousPool,
      defenses: { ...input().defenses, blockChance: 75 },
      random: () => 0,
    }),
  );
  const evaded = resolveHuntingExpedition(
    input({
      pool: dangerousPool,
      defenses: { ...input().defenses, evasionMelee: 75 },
      random: () => 0,
    }),
  );

  assert.equal(unarmored.report.totalDamage, 20);
  assert.equal(armored.report.totalDamage, 10);
  assert.equal(blocked.report.totalDamage, 10);
  assert.equal(evaded.report.totalDamage, 0);
  assert.equal(evaded.report.encounters[0]?.evaded, 1);
});

void test("animals can retaliate with magic, elemental, and critical damage", () => {
  const emberFox = [
    {
      ...basicPool[0]!,
      attackStyle: "MAGIC" as const,
      attackChance: 1,
      magicDamageMin: 10,
      magicDamageMax: 10,
      damageType: "FIRE" as const,
      elementalDamageMin: 10,
      elementalDamageMax: 10,
    },
  ];
  const defenses = input().defenses;
  const bare = resolveHuntingExpedition(
    input({ pool: emberFox, random: () => 0 }),
  );
  const warded = resolveHuntingExpedition(
    input({
      pool: emberFox,
      defenses: { ...defenses, armor: 300, magicResist: 100, fireResist: 50 },
      random: () => 0,
    }),
  );
  const dodged = resolveHuntingExpedition(
    input({
      pool: emberFox,
      defenses: { ...defenses, evasionMagic: 75 },
      random: () => 0,
    }),
  );
  const critical = resolveHuntingExpedition(
    input({
      pool: [{ ...emberFox[0]!, critChance: 100, critDamage: 150 }],
      random: () => 0,
    }),
  );
  assert.equal(bare.report.totalDamage, 20);
  assert.equal(warded.report.totalDamage, 10);
  assert.equal(dodged.report.totalDamage, 0);
  assert.equal(critical.report.totalDamage, 30);
});

void test("global safety settings can disable damage and cap health loss", () => {
  const dangerousPool = [
    {
      ...basicPool[0]!,
      attackChance: 1,
      damageMin: 80,
      damageMax: 80,
    },
  ];
  const capped = resolveHuntingExpedition(
    input({
      pool: dangerousPool,
      encounterRolls: 4,
      maxHealthLossPercent: 30,
      random: () => 0,
    }),
  );
  const disabled = resolveHuntingExpedition(
    input({ pool: dangerousPool, damageEnabled: false, random: () => 0 }),
  );
  assert.equal(capped.report.totalDamage, 30);
  assert.equal(disabled.report.totalDamage, 0);
});

void test("live admin guardrails can only make an active hunt safer", () => {
  const safer = applyLiveHuntingSafety(
    {
      damageEnabled: true,
      globalDangerMultiplier: 1,
      maxHealthLossPercent: 30,
      minimumRemainingHealthPercent: 5,
    },
    {
      damageEnabled: false,
      globalDangerMultiplier: 0.5,
      maxHealthLossPercent: 20,
      minimumRemainingHealthPercent: 10,
    },
  );
  assert.deepEqual(safer, {
    damageEnabled: false,
    globalDangerMultiplier: 0.5,
    maxHealthLossPercent: 20,
    minimumRemainingHealthPercent: 10,
  });

  const attemptedIncrease = applyLiveHuntingSafety(
    {
      damageEnabled: false,
      globalDangerMultiplier: 0.5,
      maxHealthLossPercent: 20,
      minimumRemainingHealthPercent: 10,
    },
    {
      damageEnabled: true,
      globalDangerMultiplier: 2,
      maxHealthLossPercent: 60,
      minimumRemainingHealthPercent: 0,
    },
  );
  assert.deepEqual(attemptedIncrease, {
    damageEnabled: false,
    globalDangerMultiplier: 0.5,
    maxHealthLossPercent: 20,
    minimumRemainingHealthPercent: 10,
  });
});

void test("live health regenerates lazily and Hunting damage cannot defeat the character", () => {
  const regenerated = resolveRegeneratedHealth({
    currentHealth: 40,
    maxHealth: 100,
    healthRegen: 2,
    regeneratedAt: new Date(0),
    now: new Date(20_000),
  });
  assert.equal(regenerated, 80);

  const floored = calculateHealthAfterDamage({
    currentHealth: regenerated,
    maxHealth: 100,
    requestedDamage: 500,
    minimumRemainingHealthPercent: 5,
  });
  assert.deepEqual(floored, {
    currentHealth: 5,
    appliedDamage: 75,
    floor: 5,
  });

  const nonLethal = calculateHealthAfterDamage({
    currentHealth: 100,
    maxHealth: 100,
    requestedDamage: 500,
    minimumRemainingHealthPercent: 0,
  });
  assert.equal(nonLethal.currentHealth, 1);
});

void test("longer durations increase encounters, rewards, XP, and controlled danger", () => {
  const sorted = [...HUNTING_DURATIONS].sort(
    (a, b) => a.durationSeconds - b.durationSeconds,
  );
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(
      sorted[index]!.encounterRolls > sorted[index - 1]!.encounterRolls,
    );
    assert.ok(sorted[index]!.xpReward > sorted[index - 1]!.xpReward);
    assert.ok(
      sorted[index]!.quantityMultiplier >=
        sorted[index - 1]!.quantityMultiplier,
    );
    assert.ok(
      sorted[index]!.dangerMultiplier >= sorted[index - 1]!.dangerMultiplier,
    );
  }
});

void test("all Hunting material and animal assets are production-sized RGBA PNGs", () => {
  const assets = [
    ...HUNTING_ITEMS.map((item) => ({ name: item.name, path: item.sprite })),
    ...HUNTING_CREATURES.map((creature) => ({
      name: creature.name,
      path: creature.asset,
    })),
  ];
  for (const asset of assets) {
    const png = readFileSync(
      new URL(`../public${asset.path}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[25], 6, `${asset.name} must retain RGBA transparency`);
  }
});
