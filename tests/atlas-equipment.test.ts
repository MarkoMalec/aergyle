import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ATLAS_ARMOR_SLOTS,
  ATLAS_EQUIPMENT,
  atlasItemCreateData,
  atlasSpritePath,
} from "../prisma/content/atlasEquipment";
import {
  canEquipToSlot,
  getDisplacedHand,
  getEquipmentValidationError,
  meetsItemLevelRequirement,
} from "../src/utils/inventoryClient";

void test("the pack contains five distinct weapons and complete Rare/Epic armor sets", () => {
  assert.equal(ATLAS_EQUIPMENT.length, 21);
  assert.equal(new Set(ATLAS_EQUIPMENT.map((item) => item.slug)).size, 21);
  assert.equal(new Set(ATLAS_EQUIPMENT.map((item) => item.name)).size, 21);
  const weapons = ATLAS_EQUIPMENT.filter((item) => !item.set);
  assert.equal(weapons.length, 5);
  assert.equal(new Set(weapons.map((item) => item.itemType)).size, 5);
  for (const [set, level, rarity] of [
    ["trailwarden", 1, "RARE"],
    ["duskwarden", 50, "EPIC"],
  ] as const) {
    const pieces = ATLAS_EQUIPMENT.filter((item) => item.set === set);
    assert.equal(pieces.length, 8);
    assert.deepEqual(
      new Set(pieces.map((item) => item.equipTo)),
      new Set(ATLAS_ARMOR_SLOTS),
    );
    for (const item of pieces) {
      assert.equal(item.rarity, rarity);
      assert.equal(item.requiredLevel, level);
      assert.ok((item.stats.ARMOR ?? 0) > 0);
    }
  }
});

void test("all item definitions point to separate, optimized RGBA sprites", () => {
  assert.equal(new Set(ATLAS_EQUIPMENT.map(atlasSpritePath)).size, 21);
  for (const item of ATLAS_EQUIPMENT) {
    const sprite = readFileSync(
      new URL(`../public${atlasSpritePath(item)}`, import.meta.url),
    );
    assert.equal(sprite.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(sprite.readUInt32BE(16), 256);
    assert.equal(sprite.readUInt32BE(20), 256);
    assert.equal(sprite[25], 6, `${item.slug} needs RGB plus alpha`);
    assert.ok(sprite.length < 150_000);
  }
});

void test("template and indexed stats stay at base values without applying rarity twice", () => {
  for (const item of ATLAS_EQUIPMENT) {
    const data = atlasItemCreateData(item);
    assert.equal(data.armor, item.stats.ARMOR ?? 0);
    assert.equal(data.minPhysicalDamage, item.stats.PHYSICAL_DAMAGE_MIN ?? 0);
    assert.equal(data.maxPhysicalDamage, item.stats.PHYSICAL_DAMAGE_MAX ?? 0);
    assert.equal(data.minMagicDamage, item.stats.MAGIC_DAMAGE_MIN ?? 0);
    assert.equal(data.maxMagicDamage, item.stats.MAGIC_DAMAGE_MAX ?? 0);
    assert.equal(data.rarity, item.rarity);
    assert.equal(data.stackable, false);
    assert.equal(data.maxStackSize, 1);
    assert.deepEqual(
      data.stats?.create,
      Object.entries(item.stats).map(([statType, value]) => ({
        statType,
        value,
      })),
    );
    assert.ok(Number.isInteger(item.requiredLevel) && item.requiredLevel >= 1);
    assert.ok(item.price > 0);
    assert.ok(
      Object.values(item.stats).every(
        (value) => Number.isFinite(value) && value > 0,
      ),
    );
    assert.ok(
      (item.stats.PHYSICAL_DAMAGE_MAX ?? 0) >=
        (item.stats.PHYSICAL_DAMAGE_MIN ?? 0),
    );
    assert.ok(
      (item.stats.MAGIC_DAMAGE_MAX ?? 0) >= (item.stats.MAGIC_DAMAGE_MIN ?? 0),
    );
  }
});

const epicHelm = {
  id: 101,
  name: "Duskwarden Helm",
  equipTo: "head",
  requiredLevel: 50,
};
const beginnerHelm = {
  id: 102,
  name: "Trailwarden Helm",
  equipTo: "head",
  requiredLevel: 1,
};

void test("high-level equipment is locked below its requirement and unlocks at the exact level", () => {
  assert.equal(meetsItemLevelRequirement(epicHelm, 49), false);
  assert.equal(meetsItemLevelRequirement(epicHelm, 50), true);
  assert.equal(meetsItemLevelRequirement(beginnerHelm, 1), true);
  assert.equal(meetsItemLevelRequirement(beginnerHelm, Number.NaN), false);
  assert.equal(meetsItemLevelRequirement({ requiredLevel: null }, 0), false);
  assert.equal(meetsItemLevelRequirement({ requiredLevel: null }, 1), true);
  assert.match(
    getEquipmentValidationError({ head: 101 }, [epicHelm], 49) ?? "",
    /Requires level 50/,
  );
  assert.equal(
    getEquipmentValidationError({ head: 101 }, [epicHelm], 50),
    null,
  );
  assert.equal(
    getEquipmentValidationError({ head: 102 }, [beginnerHelm], 1),
    null,
  );
});

void test("equipping validates owned instance availability, slots and duplicate instances", () => {
  const ring = { id: 103, name: "Ring", equipTo: "ring", requiredLevel: 1 };
  assert.ok(getEquipmentValidationError({ head: 999 }, [beginnerHelm], 50));
  assert.ok(getEquipmentValidationError({ chest: 102 }, [beginnerHelm], 50));
  assert.ok(getEquipmentValidationError({ head: -1 }, [], 50));
  assert.ok(getEquipmentValidationError({ head: 1.5 }, [], 50));
  assert.ok(
    getEquipmentValidationError({ ring1: 103, ring2: 103 }, [ring], 50),
  );
  assert.equal(getEquipmentValidationError({ ring2: 103 }, [ring], 1), null);
  assert.equal(
    getEquipmentValidationError({ head: null, chest: null }, [], 1),
    null,
  );
});

void test("the off hand takes shields and one-handed weapons; two-handed weapons need both hands", () => {
  const sword = {
    id: 201,
    name: "Sword",
    equipTo: "weapon",
    twoHanded: false,
    requiredLevel: 1,
  };
  const dagger = {
    id: 202,
    name: "Dagger",
    equipTo: "weapon",
    requiredLevel: 1,
  };
  const shield = {
    id: 203,
    name: "Shield",
    equipTo: "offhand",
    requiredLevel: 1,
  };
  const greatsword = {
    id: 204,
    name: "Greatsword",
    equipTo: "weapon",
    twoHanded: true,
    requiredLevel: 1,
  };
  const owned = [sword, dagger, shield, greatsword];

  assert.equal(canEquipToSlot(sword, "weapon"), true);
  assert.equal(canEquipToSlot(sword, "offhand"), true);
  assert.equal(canEquipToSlot(shield, "offhand"), true);
  assert.equal(canEquipToSlot(shield, "weapon"), false);
  assert.equal(canEquipToSlot(greatsword, "weapon"), true);
  assert.equal(canEquipToSlot(greatsword, "offhand"), false);

  assert.equal(
    getEquipmentValidationError({ weapon: 201, offhand: 202 }, owned, 1),
    null,
  );
  assert.equal(
    getEquipmentValidationError({ weapon: 201, offhand: 203 }, owned, 1),
    null,
  );
  assert.equal(
    getEquipmentValidationError({ weapon: 204, offhand: null }, owned, 1),
    null,
  );
  assert.match(
    getEquipmentValidationError({ weapon: 204, offhand: 203 }, owned, 1) ?? "",
    /two-handed/,
  );

  // The hand that just changed keeps its item; the other goes to the bags.
  assert.equal(
    getDisplacedHand({ weapon: greatsword, offhand: shield }, "weapon"),
    "offhand",
  );
  assert.equal(
    getDisplacedHand({ weapon: greatsword, offhand: shield }, "offhand"),
    "weapon",
  );
  assert.equal(
    getDisplacedHand({ weapon: sword, offhand: shield }, "weapon"),
    null,
  );
  assert.equal(
    getDisplacedHand({ weapon: greatsword, offhand: null }, "weapon"),
    null,
  );
});
