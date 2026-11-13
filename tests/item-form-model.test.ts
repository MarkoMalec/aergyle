import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ItemEquipTo,
  ItemStatOverrideKind,
  StatType,
  VocationalActionType,
} from "../src/generated/prisma/enums";
import {
  baseStatsCodec,
  buildPreviewRows,
  foodEffectStatsCodec,
  itemFormSnapshot,
  previewCell,
  enchantOverridesCodec,
  enchantUnlocksCodec,
  toolEfficienciesCodec,
} from "../src/components/admin/items/itemFormModel";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

const LEVELS = Array.from({ length: 21 }, (_, level) => level);
const bonusAt = (level: number) => level * 7.5;

void test("every balance table survives a trip through its CSV", () => {
  const base = [
    { statType: StatType.CARRYING_CAPACITY, value: 13, maxValue: null },
    { statType: StatType.MOVEMENT_SPEED, value: -5, maxValue: -1 },
  ];
  assert.deepEqual(baseStatsCodec.parse(baseStatsCodec.toCsv(base)).rows, base);

  const tools = [{ actionType: VocationalActionType.MINING, baseEfficiency: 12.5 }];
  assert.deepEqual(toolEfficienciesCodec.parse(toolEfficienciesCodec.toCsv(tools)).rows, tools);

  const unlocks = [{ statType: StatType.LIFESTEAL, value: 3, level: 18 }];
  assert.deepEqual(enchantUnlocksCodec.parse(enchantUnlocksCodec.toCsv(unlocks)).rows, unlocks);

  const overrides = [
    {
      statType: StatType.ACCURACY,
      level: 7,
      kind: ItemStatOverrideKind.MULTIPLIER,
      value: 1.15,
    },
  ];
  assert.deepEqual(
    enchantOverridesCodec.parse(enchantOverridesCodec.toCsv(overrides)).rows,
    overrides,
  );

  const bonuses = [{ statType: StatType.LUCK, value: 5 }];
  assert.deepEqual(foodEffectStatsCodec.parse(foodEffectStatsCodec.toCsv(bonuses)).rows, bonuses);
});

void test("enchant levels outside 1-20 and duplicate overrides are rejected", () => {
  assert.match(
    enchantOverridesCodec.parse("statType,level,kind,value\nARMOR,21,ABSOLUTE,7").error ?? "",
    /Invalid enchant level/,
  );
  assert.match(
    enchantUnlocksCodec.parse("statType,value,level\nLUCK,1,0").error ?? "",
    /Invalid enchant level/,
  );
  assert.match(
    enchantOverridesCodec.parse(
      "statType,level,kind,value\nARMOR,5,ABSOLUTE,7\nARMOR,5,MULTIPLIER,2",
    ).error ?? "",
    /listed twice/,
  );
});

void test("a malformed CSV row reports which row is wrong", () => {
  const parsed = baseStatsCodec.parse("statType,value,maxValue\nLUCK,1,\nNOT_A_STAT,2,");
  assert.equal(parsed.error, "Invalid statType on row 2: NOT_A_STAT");
});

void test("the snapshot ignores differences that save the same item", () => {
  const saved = {
    name: "Sword",
    sprite: "/a.png",
    price: 250,
    requiredLevel: 5,
    baseStatsCsv: "statType,value,maxValue",
    toolEfficienciesCsv: "actionType,baseEfficiency\nMINING,5",
  };
  const edited = {
    ...saved,
    // Inputs report numbers as text; an emptied list drops its header.
    price: "250" as unknown as number,
    requiredLevel: "5" as unknown as number,
    baseStatsCsv: "",
    toolEfficienciesCsv: "actionType,baseEfficiency\n  MINING,5  ",
  };
  assert.equal(itemFormSnapshot(edited), itemFormSnapshot(saved));
  assert.notEqual(itemFormSnapshot({ ...saved, price: 251 }), itemFormSnapshot(saved));
  assert.notEqual(
    itemFormSnapshot({ ...saved, baseStatsCsv: "statType,value,maxValue\nLUCK,1," }),
    itemFormSnapshot(saved),
  );
});

void test("the enchant grid shows what the game computes at every level", () => {
  const stats = [
    { statType: StatType.CRITICAL_CHANCE, value: 13.5, maxValue: null },
    { statType: StatType.ATTACK_SPEED, value: 2.43, maxValue: null },
    { statType: StatType.ACCURACY, value: 20, maxValue: 45 },
    { statType: StatType.MOVEMENT_SPEED, value: -5, maxValue: -1 },
  ];
  const unlocks = [
    { statType: StatType.CRITICAL_DAMAGE, value: 5, level: 16 },
    { statType: StatType.CRITICAL_CHANCE, value: 2, level: 8 },
  ];
  const overrides = [
    {
      statType: StatType.ACCURACY,
      level: 12,
      kind: ItemStatOverrideKind.ABSOLUTE,
      value: 50,
    },
    {
      statType: StatType.CRITICAL_CHANCE,
      level: 5,
      kind: ItemStatOverrideKind.MULTIPLIER,
      value: 2,
    },
    {
      statType: StatType.MOVEMENT_SPEED,
      level: 3,
      kind: ItemStatOverrideKind.ABSOLUTE,
      value: 1,
    },
  ];
  const combat = { min: 20, max: 33 };

  const rows = buildPreviewRows({
    baseStatsCsv: baseStatsCodec.toCsv(stats),
    toolEfficienciesCsv: "",
    enchantUnlocksCsv: enchantUnlocksCodec.toCsv(unlocks),
    enchantOverridesCsv: enchantOverridesCodec.toCsv(overrides),
    minPhysicalDamage: String(combat.min),
    maxPhysicalDamage: String(combat.max),
    minMagicDamage: "",
    maxMagicDamage: null,
    armor: 0,
  });

  for (const level of LEVELS) {
    const game = new Map(
      resolveEffectiveItemStats({
        equipTo: ItemEquipTo.weapon,
        stats: [
          ...stats,
          { statType: StatType.PHYSICAL_DAMAGE_MIN, value: combat.min },
          { statType: StatType.PHYSICAL_DAMAGE_MAX, value: combat.max },
        ],
        enchantUnlocks: unlocks,
        enchantOverrides: overrides,
        enchantLevel: level,
        enchantBonusPercent: bonusAt(level),
      }).map((stat) => [stat.statType, stat.value]),
    );

    for (const row of rows) {
      const shown = previewCell(row, level, {
        equipTo: ItemEquipTo.weapon,
        bonusPercent: bonusAt(level),
      }).value;
      const expected = game.get(row.statType) ?? null;
      const where = `${row.statType} at ${level}`;
      if (expected === null) {
        assert.equal(shown, null, where);
      } else {
        assert.ok(shown !== null && Math.abs(shown - expected) < 1e-6, `${where}: ${shown} vs ${expected}`);
      }
    }
  }
});

void test("a weapon's attack speed keeps its value at every enchant level", () => {
  const [row] = buildPreviewRows({
    baseStatsCsv: "statType,value,maxValue\nATTACK_SPEED,2.4,",
    toolEfficienciesCsv: "",
    enchantUnlocksCsv: "",
    enchantOverridesCsv: "",
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    armor: 0,
  });
  const cell = previewCell(row!, 20, {
    equipTo: ItemEquipTo.weapon,
    bonusPercent: 52.5,
  });
  assert.equal(cell.value, 2.4);
  assert.equal(cell.scales, false);
});
