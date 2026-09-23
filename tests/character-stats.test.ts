import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ItemEquipTo,
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
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

const UNARMED_ATTACK_SPEED = getDefaultBaseStats()[StatType.ATTACK_SPEED];
let nextUserItemId = 100;

function equippedItem(
  equipTo: string,
  stats: Array<{ statType: StatType; value: number }>,
) {
  return {
    id: nextUserItemId++,
    itemId: 9,
    name: `Test ${equipTo}`,
    price: 0,
    sprite: "/test.png",
    equipTo,
    rarity: ItemRarity.COMMON,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    armor: 0,
    requiredLevel: 1,
    stats: stats.map((stat, index) => ({ id: index + 1, itemId: 9, ...stat })),
  } satisfies ItemWithStats;
}

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
    calculateEquipmentBonuses(equipment, UNARMED_ATTACK_SPEED)[
      StatType.GATHERING_EFFICIENCY
    ],
    2,
  );
});

void test("a weapon's attack speed replaces the unarmed speed", () => {
  const base = getDefaultBaseStats();
  const attackSpeed = (equipment: Partial<EquipmentSlotsWithItems>) =>
    calculateFinalStats(
      base,
      calculateEquipmentBonuses(
        equipment as EquipmentSlotsWithItems,
        UNARMED_ATTACK_SPEED,
      ),
    ).attackSpeed;
  const mace = equippedItem("weapon", [
    { statType: StatType.ATTACK_SPEED, value: 0.55 },
  ]);
  const gloves = equippedItem("gloves", [
    { statType: StatType.ATTACK_SPEED, value: 0.1 },
  ]);
  const noSpeedWeapon = equippedItem("weapon", [
    { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 5 },
  ]);

  assert.equal(attackSpeed({}), 1);
  // A slow weapon makes the character slower, not faster.
  assert.equal(attackSpeed({ weapon: mace }), 0.55);
  // Speed on other gear still adds on top of the weapon.
  assert.equal(attackSpeed({ weapon: mace, gloves }), 0.65);
  assert.equal(attackSpeed({ gloves }), 1.1);
  // A weapon without its own speed keeps the unarmed speed.
  assert.equal(attackSpeed({ weapon: noSpeedWeapon }), 1);
  // The main hand sets the pace: an off-hand weapon's speed does not add,
  // while speed on a shield is a bonus like any other gear.
  const dagger = equippedItem("weapon", [
    { statType: StatType.ATTACK_SPEED, value: 1.4 },
  ]);
  const shield = equippedItem("offhand", [
    { statType: StatType.ATTACK_SPEED, value: 0.1 },
  ]);
  assert.equal(attackSpeed({ weapon: mace, offhand: dagger }), 0.55);
  assert.equal(attackSpeed({ weapon: mace, offhand: shield }), 0.65);
});

void test("rarity scales a weapon's damage but not its attack speed", () => {
  const resolve = (equipTo: ItemEquipTo) =>
    Object.fromEntries(
      resolveEffectiveItemStats({
        rarity: ItemRarity.DIVINE,
        rarityMultiplier: 3,
        equipTo,
        stats: [
          { statType: StatType.ATTACK_SPEED, value: 0.95 },
          { statType: StatType.PHYSICAL_DAMAGE_MAX, value: 9 },
        ],
      }).map((stat) => [stat.statType, stat.value]),
    );

  const weapon = resolve(ItemEquipTo.weapon);
  assert.equal(weapon[StatType.ATTACK_SPEED], 0.95);
  assert.equal(weapon[StatType.PHYSICAL_DAMAGE_MAX], 27);
  // Attack speed on other gear is a bonus and scales like any stat.
  assert.equal(resolve(ItemEquipTo.gloves)[StatType.ATTACK_SPEED], 2.85);

  // A per-item rarity override is an explicit choice and still applies.
  const overridden = resolveEffectiveItemStats({
    rarity: ItemRarity.DIVINE,
    rarityMultiplier: 3,
    equipTo: ItemEquipTo.weapon,
    stats: [{ statType: StatType.ATTACK_SPEED, value: 1 }],
    statRarityOverrides: [
      {
        statType: StatType.ATTACK_SPEED,
        rarity: ItemRarity.DIVINE,
        kind: "MULTIPLIER",
        value: 1.2,
      },
    ],
  });
  assert.equal(overridden[0]?.value, 1.2);
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
