import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { ATLAS_EQUIPMENT } from "../prisma/content/atlasEquipment";
import { ItemRarity, StatType } from "../src/generated/prisma/enums";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

// This suite never connects to a game database. All used delegates are stubbed.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/atlas_tests";
const { prisma } = await import("../src/lib/prisma");
const { createUserItem } = await import("../src/utils/userItems");

function stub(
  context: TestContext,
  model: object,
  method: string,
  implementation: unknown,
) {
  const original: unknown = Reflect.get(model, method);
  assert.equal(Reflect.set(model, method, implementation), true);
  context.after(() => {
    Reflect.set(model, method, original);
  });
}

void test("an item/stat/enchant-level multiplier override applies at its level only", () => {
  const base = [{ statType: StatType.PHYSICAL_DAMAGE_MAX, value: 100 }];
  const enchantOverrides = [
    {
      statType: StatType.PHYSICAL_DAMAGE_MAX,
      level: 10,
      kind: "MULTIPLIER" as const,
      value: 1.15,
    },
  ];
  const at = (enchantLevel: number) =>
    resolveEffectiveItemStats({
      stats: base,
      enchantOverrides,
      enchantLevel,
      enchantBonusPercent: 25,
    })[0]?.value;

  assert.equal(at(0), 100);
  assert.equal(at(9), 125);
  assert.equal(at(10), 115);
});

void test("an enchant unlock adds its stat from its level upward, then scales", () => {
  const at = (enchantLevel: number) =>
    resolveEffectiveItemStats({
      stats: [],
      enchantUnlocks: [{ statType: StatType.LIFESTEAL, value: 4, level: 16 }],
      enchantLevel,
      enchantBonusPercent: 50,
    });
  assert.deepEqual(at(15), []);
  assert.deepEqual(at(16), [{ statType: StatType.LIFESTEAL, value: 6 }]);
});

void test("instance creation always takes the template's rarity, without materializing stats", async (context) => {
  let definition = ATLAS_EQUIPMENT.find(
    (item) => item.slug === "trailwarden-jerkin",
  )!;
  const created: Array<{ rarity: ItemRarity }> = [];
  stub(context, prisma.item, "findUnique", async () => ({
    id: 777,
    ...definition,
    stackable: false,
  }));
  stub(
    context,
    prisma.userItem,
    "create",
    async ({ data }: { data: { rarity: ItemRarity } }) => {
      created.push(data);
      return { id: created.length };
    },
  );

  for (const [slug, expected] of [
    ["trailwarden-jerkin", "RARE"],
    ["duskwarden-cuirass", "EPIC"],
  ] as const) {
    definition = ATLAS_EQUIPMENT.find((item) => item.slug === slug)!;
    await createUserItem("test-only", 777);
    assert.equal(created.at(-1)?.rarity, expected);
  }
  await prisma.$disconnect();
});
