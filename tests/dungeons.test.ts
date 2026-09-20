import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COMPONENT_ITEMS } from "../prisma/content/componentExpansion";
import { DUNGEON_MONSTERS, DUNGEONS } from "../prisma/content/dungeons";
import { HUNTING_ITEMS } from "../prisma/content/hunting";
import { TAILORING_ITEMS } from "../prisma/content/tailoring";
import { WORLD_ATLAS_LOCATION_MARKERS } from "../src/game/world/atlasLocations";
import {
  applyDungeonDeathPenalty,
  resolveDungeonRun,
  type DungeonCombatSnapshot,
  type DungeonMonsterPoolEntry,
  type DungeonResolutionInput,
} from "../src/server/dungeons/resolver";
import { estimateRecommendedHealth } from "../src/server/dungeons/simulator";
import { createExpeditionRandom } from "../src/server/expeditions/random";

const combat: DungeonCombatSnapshot = {
  maxHealth: 100,
  physicalDamageMin: 5,
  physicalDamageMax: 5,
  magicDamageMin: 0,
  magicDamageMax: 0,
  criticalChance: 0,
  criticalDamage: 150,
  attackSpeed: 1,
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
  luck: 0,
};

// Dies to one character strike (5 damage) yet still lands its simultaneous
// blow: 20 physical + 10 fire.
const brute: DungeonMonsterPoolEntry = {
  creatureId: 1,
  name: "Brute",
  asset: "/brute.png",
  minCount: 1,
  maxCount: 1,
  health: 5,
  armor: 0,
  magicResist: 0,
  evasion: 0,
  blockChance: 0,
  critChance: 0,
  critDamage: 0,
  attackStyle: "MELEE",
  damageMin: 20,
  damageMax: 20,
  magicDamageMin: 0,
  magicDamageMax: 0,
  damageType: "FIRE",
  elementalDamageMin: 10,
  elementalDamageMax: 10,
  drops: [],
};

const looter: DungeonMonsterPoolEntry = {
  ...brute,
  creatureId: 2,
  name: "Looter",
  health: 1,
  damageMin: 0,
  damageMax: 0,
  damageType: null,
  drops: [
    {
      dropId: 1,
      itemId: 50,
      name: "Dusk Oil",
      sprite: "/oil.png",
      rarity: "COMMON",
      baseChance: 1,
      minQuantity: 4,
      maxQuantity: 4,
    },
  ],
};

function input(
  overrides: Partial<DungeonResolutionInput> = {},
): DungeonResolutionInput {
  return {
    pool: [brute],
    combat,
    startingHealth: 100,
    packSize: 1,
    deathRules: { keepChance: 0.35, quantityPercent: 25 },
    random: () => 0,
    ...overrides,
  };
}

void test("armor reduces physical damage and the matching resistance reduces elemental damage", () => {
  const bare = resolveDungeonRun(input());
  const armored = resolveDungeonRun(
    input({ combat: { ...combat, armor: 100 } }),
  );
  const fireproof = resolveDungeonRun(
    input({ combat: { ...combat, fireResist: 50 } }),
  );
  const wrongResist = resolveDungeonRun(
    input({ combat: { ...combat, coldResist: 75 } }),
  );
  assert.equal(bare.report.outcome, "CLEARED");
  assert.equal(bare.report.damageTaken, 30);
  assert.equal(armored.report.damageTaken, 20);
  assert.equal(fireproof.report.damageTaken, 25);
  assert.equal(wrongResist.report.damageTaken, 30);
});

void test("magic damage uses magic resistance, ice uses cold resistance, and style picks the evasion", () => {
  const frostMage = {
    ...brute,
    attackStyle: "MAGIC" as const,
    damageMin: 0,
    damageMax: 0,
    magicDamageMin: 20,
    magicDamageMax: 20,
    damageType: "ICE" as const,
  };
  const defended = { ...combat, armor: 300, magicResist: 100, coldResist: 50 };
  const hit = resolveDungeonRun(
    input({ pool: [frostMage], combat: { ...defended, evasionMelee: 75 } }),
  );
  const dodged = resolveDungeonRun(
    input({ pool: [frostMage], combat: { ...defended, evasionMagic: 75 } }),
  );
  assert.equal(hit.report.damageTaken, 15);
  assert.equal(dodged.report.damageTaken, 0);
});

void test("evasion, block, and creature critical hits change the landed blow", () => {
  const evaded = resolveDungeonRun(
    input({ combat: { ...combat, evasionMelee: 75 } }),
  );
  const blocked = resolveDungeonRun(
    input({ combat: { ...combat, blockChance: 75 } }),
  );
  const critical = resolveDungeonRun(
    input({ pool: [{ ...brute, critChance: 100, critDamage: 200 }] }),
  );
  assert.equal(evaded.report.damageTaken, 0);
  assert.equal(evaded.report.evaded, 1);
  assert.equal(blocked.report.damageTaken, 15);
  assert.equal(blocked.report.blocked, 1);
  assert.equal(critical.report.damageTaken, 60);
});

void test("every monster strikes back at least once; attack speed shortens longer fights", () => {
  const sturdy = [{ ...brute, health: 10 }];
  const slow = resolveDungeonRun(input({ pool: sturdy }));
  const fast = resolveDungeonRun(
    input({ pool: sturdy, combat: { ...combat, attackSpeed: 2 } }),
  );
  const oneShot = resolveDungeonRun(
    input({
      combat: { ...combat, physicalDamageMin: 500, physicalDamageMax: 500 },
    }),
  );
  assert.equal(slow.report.damageTaken, 60);
  assert.equal(fast.report.damageTaken, 30);
  assert.equal(oneShot.report.damageTaken, 30);
});

void test("packs make every engaged monster strike each round", () => {
  const trio = [{ ...brute, minCount: 3, maxCount: 3 }];
  const single = resolveDungeonRun(
    input({ pool: trio, startingHealth: 1_000 }),
  );
  const swarm = resolveDungeonRun(
    input({ pool: trio, startingHealth: 1_000, packSize: 3 }),
  );
  // Three strikes in one round clear the whole pack, but all three still swing.
  const fastSwarm = resolveDungeonRun(
    input({
      pool: trio,
      startingHealth: 1_000,
      packSize: 3,
      combat: { ...combat, attackSpeed: 3 },
    }),
  );
  assert.equal(single.report.damageTaken, 90);
  assert.equal(swarm.report.damageTaken, 90 + 60 + 30);
  assert.equal(fastSwarm.report.damageTaken, 90);
});

void test("a cleared run keeps every drop from defeated monsters", () => {
  // Shuffling with random() = 0 fights the looter first.
  const result = resolveDungeonRun(input({ pool: [brute, looter] }));
  assert.equal(result.report.outcome, "CLEARED");
  assert.deepEqual(result.rewards, [
    {
      itemId: 50,
      name: "Dusk Oil",
      sprite: "/oil.png",
      rarity: "COMMON",
      quantity: 4,
    },
  ]);
});

void test("kills are counted per monster for quests, outside the report", () => {
  const cleared = resolveDungeonRun(
    input({ pool: [brute, { ...looter, minCount: 3, maxCount: 3 }] }),
  );
  assert.deepEqual(
    [...cleared.kills].sort((a, b) => a.creatureId - b.creatureId),
    [
      { creatureId: 1, count: 1 },
      { creatureId: 2, count: 3 },
    ],
  );
  assert.equal("kills" in cleared.report, false);

  // A monster slain in the round the character falls does not count.
  const fell = resolveDungeonRun(input({ startingHealth: 25 }));
  assert.equal(fell.report.outcome, "DEFEATED");
  assert.deepEqual(fell.kills, []);
});

void test("defeat ends the run at zero health and heavily penalizes the loot", () => {
  const kept = resolveDungeonRun(
    input({ pool: [brute, looter], startingHealth: 25 }),
  );
  assert.equal(kept.report.outcome, "DEFEATED");
  assert.equal(kept.report.damageTaken, 25);
  assert.equal(kept.report.defeatedBy?.name, "Brute");
  assert.equal(kept.rewards[0]?.quantity, 1);

  const lost = resolveDungeonRun(
    input({
      pool: [brute, looter],
      startingHealth: 25,
      deathRules: { keepChance: 0, quantityPercent: 25 },
    }),
  );
  assert.equal(lost.report.outcome, "DEFEATED");
  assert.deepEqual(lost.rewards, []);
});

void test("a monster slain in the round the character falls drops nothing", () => {
  const carrier = [{ ...brute, drops: looter.drops }];
  const rules = { keepChance: 1, quantityPercent: 100 };
  const survived = resolveDungeonRun(
    input({ pool: carrier, deathRules: rules }),
  );
  const fell = resolveDungeonRun(
    input({ pool: carrier, startingHealth: 25, deathRules: rules }),
  );
  assert.equal(survived.rewards[0]?.quantity, 4);
  assert.equal(fell.report.outcome, "DEFEATED");
  assert.deepEqual(fell.rewards, []);
});

void test("the death penalty keeps a share of each surviving stack, never below one", () => {
  const rewards = [
    {
      itemId: 1,
      name: "A",
      sprite: "/a.png",
      rarity: "COMMON" as const,
      quantity: 10,
    },
    {
      itemId: 2,
      name: "B",
      sprite: "/b.png",
      rarity: "COMMON" as const,
      quantity: 1,
    },
  ];
  const penalized = applyDungeonDeathPenalty(
    rewards,
    { keepChance: 1, quantityPercent: 25 },
    () => 0.5,
  );
  assert.deepEqual(
    penalized.map((reward) => reward.quantity),
    [2, 1],
  );
});

void test("run reports never reveal how many monsters were fought", () => {
  const result = resolveDungeonRun(
    input({
      pool: [{ ...looter, minCount: 3, maxCount: 3 }],
      random: createExpeditionRandom("count-check"),
    }),
  );
  assert.equal(result.report.encounters.length, 1);
  assert.deepEqual(Object.keys(result.report.encounters[0]!).sort(), [
    "asset",
    "creatureId",
    "damageTaken",
    "name",
  ]);
});

void test("a snapshotted seed makes claim retries resolve identically", () => {
  const pool = [{ ...brute, minCount: 2, maxCount: 5 }, looter];
  const first = resolveDungeonRun(
    input({ pool, random: createExpeditionRandom("run-7") }),
  );
  const retry = resolveDungeonRun(
    input({ pool, random: createExpeditionRandom("run-7") }),
  );
  assert.deepEqual(retry, first);
});

void test("recommended health is stable, scales with population and pack size, and flags unwinnable dungeons", () => {
  const few = [{ ...brute, health: 10, minCount: 1, maxCount: 2 }];
  const many = [{ ...brute, health: 10, minCount: 4, maxCount: 6 }];
  const params = {
    combat: { ...combat, evasionMelee: 20 },
    packSize: 1,
    seed: "rec",
  };
  const fewHealth = estimateRecommendedHealth({ ...params, pool: few });
  assert.equal(fewHealth, estimateRecommendedHealth({ ...params, pool: few }));
  assert.ok(fewHealth !== null && fewHealth > 0);
  const manyHealth = estimateRecommendedHealth({ ...params, pool: many });
  assert.ok(manyHealth !== null && manyHealth > fewHealth);
  const swarmHealth = estimateRecommendedHealth({
    ...params,
    pool: many,
    packSize: 3,
  });
  assert.ok(swarmHealth !== null && swarmHealth > manyHealth);

  const unwinnable = estimateRecommendedHealth({
    ...params,
    pool: few,
    combat: { ...combat, physicalDamageMin: 0, physicalDamageMax: 0 },
    iterations: 5,
  });
  assert.equal(unwinnable, null);
});

void test("starter dungeon content is placed in Crownhold with valid monsters and loot", () => {
  const locations = new Set(
    WORLD_ATLAS_LOCATION_MARKERS.map((location) => location.name),
  );
  const monsterNames = new Set(DUNGEON_MONSTERS.map((monster) => monster.name));
  const knownItems = new Set<string>([
    ...HUNTING_ITEMS.map((item) => item.name),
    ...COMPONENT_ITEMS.map((item) => item.name),
    ...TAILORING_ITEMS.map((item) => item.name),
    "Wooden Dagger",
  ]);

  assert.equal(DUNGEONS.length, 1);
  assert.equal(DUNGEONS[0].locationName, "Crownhold");
  for (const dungeon of DUNGEONS) {
    assert.ok(locations.has(dungeon.locationName));
    assert.ok(dungeon.durationSeconds >= 60);
    assert.ok(dungeon.monsters.length > 0);
    for (const monster of dungeon.monsters) {
      assert.ok(monsterNames.has(monster.name));
      assert.ok(monster.maxCount >= monster.minCount && monster.minCount >= 1);
    }
  }
  for (const monster of DUNGEON_MONSTERS) {
    assert.match(monster.asset, /^\/assets\/creatures\/monsters\//);
    assert.ok(monster.health > 0);
    assert.ok(monster.damageMax >= monster.damageMin);
    for (const drop of monster.drops) {
      assert.ok(knownItems.has(drop.itemName), drop.itemName);
      assert.ok(drop.baseChance > 0 && drop.baseChance <= 1);
      assert.ok(drop.maxQuantity >= drop.minQuantity);
    }
    const png = readFileSync(
      new URL(`../public${monster.asset}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png[25], 6, `${monster.name} must retain RGBA transparency`);
  }
});
