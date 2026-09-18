import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { ATLAS_EQUIPMENT } from "../prisma/content/atlasEquipment";
import { ItemRarity, StatType } from "../src/generated/prisma/enums";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

// This suite never connects to a game database. All used delegates are stubbed.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/atlas_tests";
const { prisma } = await import("../src/lib/prisma");
const { createUserItem, addUserItemToInventory } = await import(
  "../src/utils/userItems"
);

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

void test("an item/stat/rarity multiplier override is live and item-scoped", () => {
  const base = [{ statType: StatType.PHYSICAL_DAMAGE_MAX, value: 100 }];
  const unique = resolveEffectiveItemStats({
    rarity: ItemRarity.UNIQUE,
    rarityMultiplier: 1,
    stats: base,
  });
  const legendary = resolveEffectiveItemStats({
    rarity: ItemRarity.LEGENDARY,
    rarityMultiplier: 1.25,
    stats: base,
    statRarityOverrides: [
      {
        statType: StatType.PHYSICAL_DAMAGE_MAX,
        rarity: ItemRarity.LEGENDARY,
        kind: "MULTIPLIER",
        value: 1.15,
      },
    ],
  });

  assert.equal(unique[0]?.value, 100);
  assert.equal(legendary[0]?.value, 115);
});

void test("instance creation stores rarity without materializing shared balance stats", async (context) => {
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
  stub(context, prisma.inventory, "findUnique", async () => ({
    maxSlots: 25,
    slots: [],
  }));
  stub(context, prisma.inventory, "update", async () => ({ id: 1 }));

  for (const [slug, explicit, expected] of [
    ["trailwarden-jerkin", undefined, "RARE"],
    ["duskwarden-cuirass", undefined, "EPIC"],
    ["duskwarden-cuirass", "COMMON", "COMMON"],
    ["trailwarden-jerkin", "EPIC", "EPIC"],
  ] as const) {
    definition = ATLAS_EQUIPMENT.find((item) => item.slug === slug)!;
    await createUserItem("test-only", 777, explicit);
    assert.equal(created.at(-1)?.rarity, expected);
  }

  for (const slug of ["trailwarden-jerkin", "duskwarden-cuirass"]) {
    definition = ATLAS_EQUIPMENT.find((item) => item.slug === slug)!;
    const result = await addUserItemToInventory("test-only", 777);
    assert.equal(result.success, true);
    assert.equal(created.at(-1)?.rarity, definition.rarity);
  }
  await prisma.$disconnect();
});
