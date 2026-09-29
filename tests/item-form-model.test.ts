import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ItemEquipTo,
  ItemRarity,
  ItemStatRarityOverrideKind,
  StatType,
  VocationalActionType,
} from "../src/generated/prisma/enums";
import {
  baseStatsCodec,
  buildPreviewRows,
  foodEffectStatsCodec,
  itemFormSnapshot,
  previewCell,
  statProgressionsCodec,
  statRarityOverridesCodec,
  toolEfficienciesCodec,
} from "../src/components/admin/items/itemFormModel";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

const RARITIES = Object.values(ItemRarity) as ItemRarity[];
const MULTIPLIERS = new Map<ItemRarity, number>(
  RARITIES.map((rarity, index) => [rarity, 0.5 + index * 0.25]),
);

void test("every balance table survives a trip through its CSV", () => {
  const base = [
    { statType: StatType.CARRYING_CAPACITY, value: 13, maxValue: null },
    { statType: StatType.MOVEMENT_SPEED, value: -5, maxValue: -1 },
  ];
  assert.deepEqual(baseStatsCodec.parse(baseStatsCodec.toCsv(base)).rows, base);

  const tools = [{ actionType: VocationalActionType.MINING, baseEfficiency: 12.5 }];
  assert.deepEqual(toolEfficienciesCodec.parse(toolEfficienciesCodec.toCsv(tools)).rows, tools);

  const unlocks = [
    { statType: StatType.LIFESTEAL, baseValue: 3, unlocksAtRarity: ItemRarity.DIVINE },
  ];
  assert.deepEqual(statProgressionsCodec.parse(statProgressionsCodec.toCsv(unlocks)).rows, unlocks);

  const overrides = [
    {
      statType: StatType.ACCURACY,
      rarity: ItemRarity.EPIC,
      kind: ItemStatRarityOverrideKind.MULTIPLIER,
      value: 1.15,
    },
  ];
  assert.deepEqual(
    statRarityOverridesCodec.parse(statRarityOverridesCodec.toCsv(overrides)).rows,
    overrides,
  );

  const bonuses = [{ statType: StatType.LUCK, value: 5 }];
  assert.deepEqual(foodEffectStatsCodec.parse(foodEffectStatsCodec.toCsv(bonuses)).rows, bonuses);
});

void test("an override row without a kind column is an exact value", () => {
  const parsed = statRarityOverridesCodec.parse("statType,rarity,value\nARMOR,RARE,7");
  assert.equal(parsed.error, null);
  assert.equal(parsed.rows[0]?.kind, ItemStatRarityOverrideKind.ABSOLUTE);
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

void test("the rarity grid shows what the game computes for every rarity", () => {
  const stats = [
    { statType: StatType.CRITICAL_CHANCE, value: 13.5, maxValue: null },
    { statType: StatType.ATTACK_SPEED, value: 2.43, maxValue: null },
    { statType: StatType.ACCURACY, value: 20, maxValue: 45 },
    { statType: StatType.MOVEMENT_SPEED, value: -5, maxValue: -1 },
  ];
  const progressions = [
    { statType: StatType.CRITICAL_DAMAGE, baseValue: 5, unlocksAtRarity: ItemRarity.UNIQUE },
    { statType: StatType.CRITICAL_CHANCE, baseValue: 2, unlocksAtRarity: ItemRarity.EPIC },
  ];
  const overrides = [
    {
      statType: StatType.ACCURACY,
      rarity: ItemRarity.EPIC,
      kind: ItemStatRarityOverrideKind.ABSOLUTE,
      value: 50,
    },
    {
      statType: StatType.CRITICAL_CHANCE,
      rarity: ItemRarity.RARE,
      kind: ItemStatRarityOverrideKind.MULTIPLIER,
      value: 2,
    },
  ];
  const combat = { min: 20, max: 33 };

  for (const flip of [false, true]) {
    const rows = buildPreviewRows({
      baseStatsCsv: baseStatsCodec.toCsv(stats),
      toolEfficienciesCsv: "",
      statProgressionsCsv: statProgressionsCodec.toCsv(progressions),
      statRarityOverridesCsv: statRarityOverridesCodec.toCsv(overrides),
      minPhysicalDamage: String(combat.min),
      maxPhysicalDamage: String(combat.max),
      minMagicDamage: "",
      maxMagicDamage: null,
      armor: 0,
    });
    const context = {
      rarityIndex: new Map(RARITIES.map((rarity, index) => [rarity, index])),
      multipliers: MULTIPLIERS,
      equipTo: ItemEquipTo.weapon,
      flipNegatives: flip,
    };

    for (const rarity of RARITIES) {
      const game = new Map(
        resolveEffectiveItemStats({
          rarity,
          rarityMultiplier: MULTIPLIERS.get(rarity)!,
          flipNegativeStatsWithRarity: flip,
          equipTo: ItemEquipTo.weapon,
          stats: [
            ...stats,
            { statType: StatType.PHYSICAL_DAMAGE_MIN, value: combat.min },
            { statType: StatType.PHYSICAL_DAMAGE_MAX, value: combat.max },
          ],
          statProgressions: progressions,
          statRarityOverrides: overrides,
        }).map((stat) => [stat.statType, stat.value]),
      );

      for (const row of rows) {
        const shown = previewCell(row, rarity, context).value;
        const expected = game.get(row.statType) ?? null;
        const where = `${row.statType} at ${rarity}, flip ${flip}`;
        if (expected === null) {
          assert.equal(shown, null, where);
        } else {
          assert.ok(shown !== null && Math.abs(shown - expected) < 1e-6, `${where}: ${shown} vs ${expected}`);
        }
      }
    }
  }
});

void test("a weapon's attack speed keeps its value at every rarity", () => {
  const [row] = buildPreviewRows({
    baseStatsCsv: "statType,value,maxValue\nATTACK_SPEED,2.4,",
    toolEfficienciesCsv: "",
    statProgressionsCsv: "",
    statRarityOverridesCsv: "",
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    armor: 0,
  });
  const cell = previewCell(row!, ItemRarity.DIVINE, {
    rarityIndex: new Map(RARITIES.map((rarity, index) => [rarity, index])),
    multipliers: MULTIPLIERS,
    equipTo: ItemEquipTo.weapon,
    flipNegatives: false,
  });
  assert.equal(cell.value, 2.4);
  assert.equal(cell.scales, false);
});
