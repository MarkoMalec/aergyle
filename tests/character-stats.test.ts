import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ItemRarity,
  StatType,
  VocationalActionType,
} from "../src/generated/prisma/enums";
import { getVocationalEfficiencyStatType } from "../src/game/vocationStats";
import type { EquipmentSlotsWithItems } from "../src/types/inventory";
import type { ItemWithStats } from "../src/types/stats";
import {
  aggregateStatValues,
  calculateEquipmentBonuses,
  calculateFinalStats,
  calculateLevelBaseStats,
  combineStatRecords,
  COMPUTED_STAT_TYPE_MAP,
  getDefaultBaseStats,
  getDefaultStatGrowthRules,
  LEVEL_SCALED_STAT_TYPES,
} from "../src/utils/stats";
import { getEquippedUserItemIds } from "../src/utils/itemEquipTo";

void test("equipment references are authoritative, exhaustive and de-duplicated", () => {
  assert.deepEqual(
    getEquippedUserItemIds({
      glovesItemId: 21,
      chestItemId: 22,
      fellingAxeItemId: 23,
      pickaxeItemId: 24,
      ring1ItemId: 21,
      bootsItemId: null,
    }),
    [22, 21, 23, 24],
  );
});

void test("character totals combine base, equipment and temporary stats once", () => {
  const base = getDefaultBaseStats();
  const equipment = aggregateStatValues([
    { statType: StatType.GATHERING_EFFICIENCY, value: 2 },
    { statType: StatType.LUCK, value: 1 },
  ]);
  const temporary = aggregateStatValues([
    { statType: StatType.GATHERING_EFFICIENCY, value: 3 },
    { statType: StatType.LUCK, value: 4 },
  ]);
  const totals = combineStatRecords(base, equipment, temporary);
  const finalStats = calculateFinalStats(base, equipment, temporary);

  assert.equal(totals[StatType.GATHERING_EFFICIENCY], 5);
  assert.equal(totals[StatType.LUCK], 5);
  assert.equal(finalStats.gatheringEfficiency, 5);
  assert.equal(finalStats.luck, 5);
});

void test("the same UserItem cannot contribute twice through two slots", () => {
  const item = {
    id: 91,
    itemId: 9,
    name: "Test gloves",
    price: 0,
    sprite: "/test.png",
    equipTo: "gloves",
    rarity: ItemRarity.COMMON,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    armor: 0,
    requiredLevel: 1,
    stats: [
      {
        id: 1,
        itemId: 9,
        statType: StatType.GATHERING_EFFICIENCY,
        value: 2,
      },
    ],
  } satisfies ItemWithStats;
  const equipment = {
    gloves: item,
    ring1: item,
  } as unknown as EquipmentSlotsWithItems;

  assert.equal(
    calculateEquipmentBonuses(equipment)[StatType.GATHERING_EFFICIENCY],
    2,
  );
});

void test("every database stat has one computed character-stat mapping", () => {
  assert.deepEqual(
    new Set(Object.values(COMPUTED_STAT_TYPE_MAP)),
    new Set(Object.values(StatType)),
  );
});

void test("item generation and vocation runtime share one efficiency mapping", () => {
  assert.equal(
    getVocationalEfficiencyStatType(VocationalActionType.WOODCUTTING),
    StatType.WOODCUTTING_EFFICIENCY,
  );
  assert.equal(
    getVocationalEfficiencyStatType(VocationalActionType.MINING),
    StatType.MINING_EFFICIENCY,
  );
  assert.equal(
    getVocationalEfficiencyStatType(VocationalActionType.FISHING),
    StatType.FISHING_EFFICIENCY,
  );
  assert.equal(
    getVocationalEfficiencyStatType(VocationalActionType.GATHERING),
    StatType.GATHERING_EFFICIENCY,
  );
  assert.equal(
    getVocationalEfficiencyStatType(VocationalActionType.TAILORING),
    null,
  );
});

void test("a level 1 character has exactly the default base stats", () => {
  assert.deepEqual(
    calculateLevelBaseStats(1, getDefaultStatGrowthRules()),
    getDefaultBaseStats(),
  );
});

void test("base stats grow a flat amount per level until the bonus cap", () => {
  const rules = getDefaultStatGrowthRules();
  rules[StatType.HEALTH] = { baseValue: 100, perLevel: 5, maxBonus: null };
  rules[StatType.CRITICAL_CHANCE] = { baseValue: 5, perLevel: 1, maxBonus: 10 };

  const level50 = calculateLevelBaseStats(50, rules);
  assert.equal(level50[StatType.HEALTH], 345);
  assert.equal(level50[StatType.CRITICAL_CHANCE], 15);
  assert.equal(calculateLevelBaseStats(8, rules)[StatType.CRITICAL_CHANCE], 12);
  // Levels below 1 never subtract.
  assert.equal(calculateLevelBaseStats(0, rules)[StatType.HEALTH], 100);
});

void test("default growth keeps neighbouring levels close but rewards levelling", () => {
  const rules = getDefaultStatGrowthRules();
  const level1 = calculateLevelBaseStats(1, rules);
  const level48 = calculateLevelBaseStats(48, rules);
  const level50 = calculateLevelBaseStats(50, rules);

  for (const statType of [
    StatType.HEALTH,
    StatType.PHYSICAL_DAMAGE_MAX,
    StatType.ARMOR,
  ]) {
    assert.ok(level50[statType] > level1[statType] * 2, statType);
    assert.ok(level50[statType] / level48[statType] < 1.05, statType);
  }
  // Chance-based stats stay far from their 75% combat caps.
  assert.ok(calculateLevelBaseStats(500, rules)[StatType.EVASION_MELEE] <= 15);
});

void test("carrying capacity never scales with level", () => {
  assert.ok(!LEVEL_SCALED_STAT_TYPES.includes(StatType.CARRYING_CAPACITY));
  assert.equal(
    getDefaultStatGrowthRules()[StatType.CARRYING_CAPACITY].perLevel,
    0,
  );
});
