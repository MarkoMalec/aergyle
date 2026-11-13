import assert from "node:assert/strict";
import { test } from "node:test";
import { ItemEquipTo, StatType } from "../src/generated/prisma/enums";
import {
  defaultEnchantLevel,
  EnchantKind,
  enchantChance,
  enchantedItemName,
  enchantGoldCost,
  enchantKindOf,
  enchantLevelsFor,
  levelAfterFailure,
  nextEnchantLevel,
} from "../src/game/enchanting";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

test("kinds: accessories, gear, and what can't be enchanted", () => {
  assert.equal(enchantKindOf({ equipTo: ItemEquipTo.ring, stackable: false }), EnchantKind.ACCESSORY);
  assert.equal(enchantKindOf({ equipTo: ItemEquipTo.belt, stackable: false }), EnchantKind.GEAR);
  assert.equal(enchantKindOf({ equipTo: ItemEquipTo.pickaxe, stackable: false }), null);
  assert.equal(enchantKindOf({ equipTo: ItemEquipTo.backpack, stackable: false }), null);
  assert.equal(enchantKindOf({ equipTo: ItemEquipTo.weapon, stackable: true }), null);
});

test("ladders: gear +1..+15 then I..V, accessories I..V only", () => {
  assert.equal(nextEnchantLevel(EnchantKind.GEAR, 0), 1);
  assert.equal(nextEnchantLevel(EnchantKind.GEAR, 15), 16);
  assert.equal(nextEnchantLevel(EnchantKind.GEAR, 20), null);
  assert.equal(nextEnchantLevel(EnchantKind.ACCESSORY, 0), 16);
  assert.deepEqual(enchantLevelsFor(EnchantKind.ACCESSORY), [16, 17, 18, 19, 20]);
  assert.equal(enchantLevelsFor(EnchantKind.GEAR).length, 20);
  assert.equal(enchantedItemName("Iron Greataxe", 7), "+7 Iron Greataxe");
  assert.equal(enchantedItemName("Silver Ring", 16), "Kindled (I) Silver Ring");
  assert.equal(enchantedItemName("Silver Ring", 20), "Ascendant (V) Silver Ring");
  assert.equal(enchantedItemName("Silver Ring", 0), "Silver Ring");
});

test("failure: gear keeps its level until Kindled, then drops one", () => {
  assert.equal(defaultEnchantLevel(EnchantKind.GEAR, 15).dropOnFail, false);
  assert.equal(defaultEnchantLevel(EnchantKind.GEAR, 16).dropOnFail, false);
  assert.equal(defaultEnchantLevel(EnchantKind.GEAR, 17).dropOnFail, true);
  assert.equal(levelAfterFailure(16, true), 15);
  assert.equal(levelAfterFailure(9, false), 9);
});

test("pity is small and capped; gold scales with item level", () => {
  const g = { pityPerFailure: 0.0025, pityCap: 0.025 };
  assert.equal(enchantChance(0.04, 0, g), 0.04);
  assert.ok(Math.abs(enchantChance(0.04, 100, g) - 0.065) < 1e-9);
  assert.equal(enchantChance(0.99, 100, g), 1);
  assert.equal(enchantGoldCost(1000, 50, 50), 2000);
  assert.equal(enchantGoldCost(1000, null, 50), 1020);
});

test("stat bonus lifts positive stats within caps, never penalties or attack speed", () => {
  const stats = resolveEffectiveItemStats({
    equipTo: ItemEquipTo.weapon,
    stats: [
      { statType: StatType.PHYSICAL_DAMAGE_MIN, value: 100 },
      { statType: StatType.CRITICAL_CHANCE, value: 4, maxValue: 5 },
      { statType: StatType.EVASION_MELEE, value: -10 },
      { statType: StatType.ATTACK_SPEED, value: 1.2 },
    ],
    enchantLevel: 15,
    enchantBonusPercent: 50,
  });
  const v = Object.fromEntries(stats.map((s) => [s.statType, s.value]));
  assert.equal(v[StatType.PHYSICAL_DAMAGE_MIN], 150);
  assert.equal(v[StatType.CRITICAL_CHANCE], 5);
  assert.equal(v[StatType.EVASION_MELEE], -10);
  assert.equal(v[StatType.ATTACK_SPEED], 1.2);
});
