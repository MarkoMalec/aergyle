import assert from "node:assert/strict";
import { test } from "node:test";
import {
  armorConstant,
  armorReduction,
  LEGACY_STRIKE_RULES,
  mitigateStrike,
  parseStrikeRules,
  protectionMultiplier,
  resolveCreatureStrike,
  strikeRulesFor,
  type CharacterDefenses,
  type CreatureAttackProfile,
} from "../src/server/combat/rules";
import {
  dungeonCombatRules,
  LEGACY_DUNGEON_RULES,
  parseDungeonCombatRules,
  resolveDungeonRun,
  type DungeonCombatSnapshot,
  type DungeonMonsterPoolEntry,
} from "../src/server/dungeons/resolver";
import { createExpeditionRandom } from "../src/server/expeditions/random";

const noDefense: CharacterDefenses = {
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
};

const mage: CreatureAttackProfile = {
  attackStyle: "MAGIC",
  damageMin: 0,
  damageMax: 0,
  magicDamageMin: 100,
  magicDamageMax: 100,
  damageType: null,
  elementalDamageMin: 0,
  elementalDamageMax: 0,
  critChance: 0,
  critDamage: 150,
};

const alwaysZero = () => 0;

void test("armor K grows with the attacker's level", () => {
  assert.equal(armorConstant(1), 53);
  assert.equal(armorConstant(50), 200);
  assert.equal(armorConstant(340), 1_070);
  assert.equal(armorConstant(0), 53, "levels below 1 count as 1");
  assert.equal(armorConstant(Number.NaN), 53);
  assert.equal(armorConstant(10, { armorK0: 0, armorK1: 0 }), 1, "never 0");
  assert.equal(armorConstant(10, { armorK0: 100, armorK1: 0 }), 100);
});

void test("armor equal to K halves damage, and every point adds the same survivability", () => {
  assert.equal(protectionMultiplier(0, 200), 1);
  assert.equal(protectionMultiplier(200, 200), 0.5);
  assert.ok(Math.abs(protectionMultiplier(1_800, 200) - 0.1) < 1e-12);
  assert.equal(protectionMultiplier(-50, 200), 1, "negative armor counts as 0");
  assert.equal(armorReduction(200, 200), 0.5);
  // Effective health is 1 / multiplier = 1 + armor / K: linear in armor.
  const ehp = (armor: number) => 1 / protectionMultiplier(armor, 200);
  assert.ok(Math.abs(ehp(400) - ehp(200) - (ehp(200) - ehp(0))) < 1e-12);
});

void test("current rules: armor covers every hit and resistances top it up", () => {
  const rules = strikeRulesFor(50); // K = 200
  const defense = { armor: 200, magicResist: 0, elementalResist: 0 };
  assert.equal(
    mitigateStrike(
      { physical: 0, magic: 100, elemental: 0 },
      defense,
      false,
      rules,
    ),
    50,
    "armor reduces magic damage",
  );
  assert.equal(
    mitigateStrike(
      { physical: 0, magic: 0, elemental: 100 },
      defense,
      false,
      rules,
    ),
    50,
    "armor reduces elemental damage",
  );
  assert.equal(
    mitigateStrike(
      { physical: 0, magic: 100, elemental: 0 },
      { ...defense, magicResist: 30 },
      false,
      rules,
    ),
    35,
    "Magic Resist is a percentage on top of armor",
  );
  assert.equal(
    mitigateStrike(
      { physical: 100, magic: 0, elemental: 0 },
      { ...defense, magicResist: 75 },
      false,
      rules,
    ),
    50,
    "Magic Resist does nothing against physical damage",
  );
  assert.equal(
    mitigateStrike(
      { physical: 0, magic: 100, elemental: 0 },
      { ...defense, magicResist: 200 },
      false,
      rules,
    ),
    12.5,
    "resistances are capped at 75%",
  );
  assert.equal(
    mitigateStrike(
      { physical: 0, magic: 100, elemental: 0 },
      { ...defense, magicResist: -50 },
      false,
      rules,
    ),
    75,
    "a negative resistance is a weakness",
  );
});

void test("current rules: block halves physical damage only", () => {
  const rules = strikeRulesFor(50);
  const defense = { armor: 0, magicResist: 0, elementalResist: 0 };
  assert.equal(
    mitigateStrike(
      { physical: 100, magic: 100, elemental: 0 },
      defense,
      true,
      rules,
    ),
    150,
  );
  assert.equal(
    mitigateStrike(
      { physical: 100, magic: 100, elemental: 0 },
      defense,
      true,
      LEGACY_STRIKE_RULES,
    ),
    100,
    "the original rules halve the whole hit",
  );
});

void test("the original rules are kept for old snapshots", () => {
  const defense = { armor: 100, magicResist: 100, elementalResist: 50 };
  assert.equal(
    mitigateStrike(
      { physical: 20, magic: 10, elemental: 10 },
      defense,
      false,
      LEGACY_STRIKE_RULES,
    ),
    10 + 5 + 5,
  );
  assert.deepEqual(parseStrikeRules(undefined), LEGACY_STRIKE_RULES);
  assert.deepEqual(
    parseStrikeRules({ version: 3, armorK: 90 }),
    LEGACY_STRIKE_RULES,
  );
  assert.deepEqual(
    parseStrikeRules({ version: 2, armorK: 0 }),
    LEGACY_STRIKE_RULES,
  );
  assert.deepEqual(parseStrikeRules({ version: 2, armorK: 245 }), {
    version: 2,
    armorK: 245,
  });
  assert.deepEqual(parseDungeonCombatRules(null), LEGACY_DUNGEON_RULES);
  const rules = dungeonCombatRules(65, 70);
  assert.deepEqual(
    parseDungeonCombatRules(JSON.parse(JSON.stringify(rules))),
    rules,
  );
  assert.equal(rules.incoming.armorK, 245, "monsters use the dungeon's level");
  assert.equal(rules.outgoing.armorK, 260, "the character uses its own level");
});

void test("a spell can't be blocked under the current rules", () => {
  const shielded = { ...noDefense, blockChance: 75 };
  const current = resolveCreatureStrike(
    mage,
    shielded,
    alwaysZero,
    strikeRulesFor(1),
  );
  assert.equal(current.blocked, false);
  assert.equal(current.damage, 100);
  const legacy = resolveCreatureStrike(mage, shielded, alwaysZero);
  assert.equal(legacy.blocked, true);
  assert.equal(legacy.damage, 50);
});

void test("an armor-only defender is no longer defenseless against magic", () => {
  const armored = { ...noDefense, armor: 200 };
  const legacy = resolveCreatureStrike(mage, armored, alwaysZero);
  const current = resolveCreatureStrike(
    mage,
    armored,
    alwaysZero,
    strikeRulesFor(50),
  );
  assert.equal(
    legacy.damage,
    100,
    "armor ignored magic under the original rules",
  );
  assert.equal(current.damage, 50);
});

void test("dungeon runs mitigate with the snapshotted K in both directions", () => {
  const combat: DungeonCombatSnapshot = {
    maxHealth: 1_000,
    physicalDamageMin: 40,
    physicalDamageMax: 40,
    magicDamageMin: 0,
    magicDamageMax: 0,
    criticalChance: 0,
    criticalDamage: 150,
    attackSpeed: 1,
    armor: 200,
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
  const ogre: DungeonMonsterPoolEntry = {
    creatureId: 1,
    name: "Ogre",
    asset: "/ogre.png",
    minCount: 1,
    maxCount: 1,
    health: 100,
    armor: 100,
    magicResist: 0,
    evasion: 0,
    blockChance: 0,
    attackStyle: "MELEE",
    damageMin: 40,
    damageMax: 40,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    critChance: 0,
    critDamage: 150,
    drops: [],
  };
  const run = (rules?: ReturnType<typeof dungeonCombatRules>) =>
    resolveDungeonRun({
      pool: [ogre],
      combat,
      startingHealth: 1_000,
      packSize: 1,
      deathRules: { keepChance: 0, quantityPercent: 0 },
      rules,
      random: createExpeditionRandom("combat-rules"),
    }).report;

  // Original: the ogre hits 40 × 100/300 per round and takes 40 × 100/200 = 20
  // per strike, so five rounds.
  const legacy = run();
  assert.equal(legacy.outcome, "CLEARED");
  assert.equal(legacy.damageTaken, Math.round(5 * (40 / 3) * 100) / 100);

  // K = 100 for the ogre's hits and K = 100 against the ogre's armor match the
  // original physical rules exactly.
  const same = run({
    incoming: { version: 2, armorK: 100 },
    outgoing: { version: 2, armorK: 100 },
  });
  assert.equal(same.damageTaken, legacy.damageTaken);

  // A stronger attacker (larger K) gets more through the same armor.
  const harder = run({
    incoming: { version: 2, armorK: 400 },
    outgoing: { version: 2, armorK: 100 },
  });
  assert.ok(harder.damageTaken > legacy.damageTaken);
  // A higher-level character (larger K) cuts through the ogre's armor faster.
  const stronger = run({
    incoming: { version: 2, armorK: 100 },
    outgoing: { version: 2, armorK: 900 },
  });
  assert.ok(stronger.damageTaken < legacy.damageTaken);
});
