import assert from "node:assert/strict";
import { test } from "node:test";
import { StatType } from "../src/generated/prisma/enums";
import {
  armorSetBudget,
  baseStatAt,
  budgetItemStats,
  itemSize,
  MATERIAL,
  monsterBudget,
  PERCENT_STATS,
  REFERENCE_RARITY_MULTIPLIER,
  referenceCharacter,
  weaponBudget,
  type BudgetContext,
  type ItemProfile,
} from "../src/game/balance/budget";
import {
  armorConstant,
  DEFAULT_COMBAT_CONFIG,
} from "../src/server/combat/rules";
import { getDefaultStatGrowthRules } from "../src/utils/stats";

const ctx: BudgetContext = {
  combat: DEFAULT_COMBAT_CONFIG,
  growth: getDefaultStatGrowthRules(),
};

const value = (stats: ReturnType<typeof budgetItemStats>, statType: StatType) =>
  stats.find((stat) => stat.statType === statType)?.value;

void test("a full on-level Rare heavy set plus base armor equals K", () => {
  for (const level of [1, 50, 150, 340]) {
    const worn =
      armorSetBudget(level, ctx) * REFERENCE_RARITY_MULTIPLIER +
      baseStatAt(StatType.ARMOR, level, ctx);
    assert.ok(Math.abs(worn - armorConstant(level)) < 1e-9, `level ${level}`);
  }
});

void test("weapon damage per round grows linearly with level", () => {
  assert.equal(weaponBudget(1), 6);
  assert.equal(weaponBudget(101), 146);
  assert.equal(weaponBudget(0), 6, "levels below 1 count as 1");
});

void test("armor pieces carry their slot's share of the set by material", () => {
  const chest: ItemProfile = {
    level: 100,
    equipTo: "chest",
    itemType: "CHESTPLATE",
    twoHanded: false,
    material: MATERIAL.heavy,
    stats: {},
  };
  const stats = budgetItemStats(chest, ctx);
  assert.equal(
    value(stats, StatType.ARMOR),
    Math.round(armorSetBudget(100, ctx) * 0.25),
  );
  const light = budgetItemStats({ ...chest, material: MATERIAL.light }, ctx);
  assert.ok(value(light, StatType.ARMOR)! < value(stats, StatType.ARMOR)!);
  assert.equal(itemSize(chest), 2, "a chest is twice an average piece");
});

void test("a weapon's damage per round matches the budget at its speed", () => {
  for (const [itemType, attackSpeed, twoHanded] of [
    ["DAGGER", 1.5, false],
    ["MACE", 0.55, false],
    ["GREATAXE", 0.65, true],
  ] as const) {
    const stats = budgetItemStats(
      {
        level: 120,
        equipTo: "weapon",
        itemType,
        twoHanded,
        attackSpeed,
        stats: {},
      },
      ctx,
    );
    const average =
      (value(stats, StatType.PHYSICAL_DAMAGE_MIN)! +
        value(stats, StatType.PHYSICAL_DAMAGE_MAX)!) /
      2;
    const expected = weaponBudget(120) * (twoHanded ? 1.3 : 1);
    assert.ok(
      Math.abs(average * attackSpeed - expected) / expected < 0.02,
      `${itemType}: ${average * attackSpeed} vs ${expected}`,
    );
    assert.equal(value(stats, StatType.ATTACK_SPEED), attackSpeed);
  }
  const staff = budgetItemStats(
    {
      level: 50,
      equipTo: "weapon",
      itemType: "STAFF",
      twoHanded: true,
      stats: {},
    },
    ctx,
  );
  assert.ok(value(staff, StatType.MAGIC_DAMAGE_MIN)! > 0, "staves deal magic");
  assert.equal(value(staff, StatType.PHYSICAL_DAMAGE_MIN), undefined);
});

void test("stats sharing an item each get less, but never become negligible", () => {
  const ring = (stats: ItemProfile["stats"]) =>
    budgetItemStats(
      {
        level: 200,
        equipTo: "ring",
        itemType: "RING",
        twoHanded: false,
        stats,
      },
      ctx,
    );
  const alone = value(ring({ CRITICAL_CHANCE: 1 }), StatType.CRITICAL_CHANCE)!;
  const shared = value(
    ring({ CRITICAL_CHANCE: 1, GOLD_FIND: 1, LUCK: 1 }),
    StatType.CRITICAL_CHANCE,
  )!;
  assert.ok(shared < alone);
  assert.ok(shared > alone / 2, "a three-stat ring keeps two thirds of each");
});

void test("percentage stats are capped per item at twice their value", () => {
  const stats = budgetItemStats(
    {
      level: 300,
      equipTo: "chest",
      itemType: "CHESTPLATE",
      twoHanded: false,
      material: MATERIAL.heavy,
      stats: { MAGIC_RESIST: 1, HEALTH: 1 },
    },
    ctx,
  );
  for (const stat of stats) {
    if (PERCENT_STATS.has(stat.statType)) {
      assert.equal(stat.maxValue, Math.round(stat.value * 2 * 10) / 10);
    } else {
      assert.equal(stat.maxValue, null);
    }
  }
});

void test("a normal monster lasts about four reference rounds", () => {
  for (const level of [10, 120, 300]) {
    const monster = monsterBudget(level, "normal", ctx);
    const reference = referenceCharacter(level, ctx);
    const k = armorConstant(level);
    const perRound = reference.damagePerRound * (k / (k + monster.armor));
    assert.ok(Math.abs(monster.health / perRound - 4) < 1e-9, `level ${level}`);
    const boss = monsterBudget(level, "boss", ctx);
    assert.ok(boss.health > monster.health * 4);
    assert.ok(boss.damage > monster.damage);
  }
});
