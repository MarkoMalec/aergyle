import assert from "node:assert/strict";
import { test } from "node:test";
import { combatAtLevel, gearForLevel } from "../src/game/balance/combat";
import type { BalanceContent, BalanceItem, BalanceResource } from "../src/game/balance/content";
import {
  applyPreset,
  buildCurve,
  CURVE_PRESETS,
  curveProblems,
  DEFAULT_CURVE_DESIGNS,
  largestFitting,
  levelForXp,
  parseCurveDesign,
  scaleDesignToTotal,
  stepXp,
  totalXpForLevel,
  type CurveDesign,
} from "../src/game/balance/curve";
import { dayReached, simulateJourney } from "../src/game/balance/journey";
import {
  ANY_LEVEL,
  DEFAULT_SOURCE_OPTIONS,
  gardenPlan,
  groupSources,
  xpPerHour,
} from "../src/game/balance/sources";
import { contentUnlocks, unlocksByLevel } from "../src/game/balance/unlocks";
import { getDefaultStatGrowthRules } from "../src/utils/stats";
import { refreshingCache } from "../src/utils/xpCurve";

const design = (patch: Partial<CurveDesign>): CurveDesign => ({
  ...DEFAULT_CURVE_DESIGNS.CHARACTER,
  ...patch,
});

void test("the default character design reproduces the live threshold table", () => {
  const curve = buildCurve(DEFAULT_CURVE_DESIGNS.CHARACTER);
  assert.equal(curve.maxLevel, 2_000);
  assert.equal(totalXpForLevel(curve, 2), 5);
  assert.equal(totalXpForLevel(curve, 3), 19);
  assert.equal(totalXpForLevel(curve, 10), 552);
  assert.equal(totalXpForLevel(curve, 100), 197_459);
  assert.equal(totalXpForLevel(curve, 2_000), 357_546_333);
});

void test("levels are found from total XP", () => {
  const curve = buildCurve(DEFAULT_CURVE_DESIGNS.CHARACTER);
  assert.equal(levelForXp(curve, 0), 1);
  assert.equal(levelForXp(curve, 4), 1);
  assert.equal(levelForXp(curve, 5), 2);
  assert.equal(levelForXp(curve, 197_459), 100);
  assert.equal(levelForXp(curve, 197_458), 99);
  assert.equal(levelForXp(curve, Number.MAX_SAFE_INTEGER), 2_000);
});

void test("steps combine power, compounding growth and bands", () => {
  const plain = design({ firstLevelXp: 10, power: 1, growthPercent: 10 });
  assert.equal(stepXp(plain, 1), 10);
  assert.equal(stepXp(plain, 2), 22); // 10 × 2 × 1.1
  const walled = { ...plain, bands: [{ fromLevel: 3, toLevel: 3, multiplier: 3 }] };
  assert.equal(stepXp(walled, 2), 66); // reaching level 3 costs ×3
  assert.equal(stepXp(walled, 3), stepXp(plain, 3));
});

void test("designs that overflow or break limits can't be saved", () => {
  assert.deepEqual(curveProblems(DEFAULT_CURVE_DESIGNS.SKILL), []);
  const runaway = design({ power: 0, growthPercent: 10.41, firstLevelXp: 83 });
  assert.match(curveProblems(runaway).join(" "), /too large after level/);
  assert.ok(curveProblems(design({ maxLevel: 1 })).length > 0);
  assert.ok(
    curveProblems(design({ bands: [{ fromLevel: 10, toLevel: 5, multiplier: 2 }] }))
      .length > 0,
  );
});

void test("presets change the shape but keep the XP needed for level 100", () => {
  const before = totalXpForLevel(buildCurve(DEFAULT_CURVE_DESIGNS.CHARACTER), 100);
  for (const preset of CURVE_PRESETS) {
    const shaped = applyPreset({ ...DEFAULT_CURVE_DESIGNS.CHARACTER, maxLevel: 150 }, preset);
    const after = totalXpForLevel(buildCurve(shaped), 100);
    assert.ok(Math.abs(after - before) / before < 0.02, `${preset.id}: ${after}`);
  }
  const scaled = scaleDesignToTotal(DEFAULT_CURVE_DESIGNS.CHARACTER, 50, 100_000);
  const total = totalXpForLevel(buildCurve(scaled), 50);
  assert.ok(Math.abs(total - 100_000) / 100_000 < 0.01);
});

void test("stored or linked designs are parsed defensively", () => {
  const fallback = DEFAULT_CURVE_DESIGNS.SKILL;
  assert.deepEqual(parseCurveDesign(null, fallback), fallback);
  const parsed = parseCurveDesign({ maxLevel: 99, bands: [{ fromLevel: 2 }], junk: 1 }, fallback);
  assert.equal(parsed.maxLevel, 99);
  assert.equal(parsed.firstLevelXp, fallback.firstLevelXp);
  assert.equal(parsed.bands.length, 1);
  assert.ok(curveProblems(parsed).length > 0); // the band is missing fields
});

function resource(patch: Partial<BalanceResource>): BalanceResource {
  return {
    id: 1,
    skill: "WOODCUTTING",
    name: "Log",
    itemId: 100,
    requiredSkillLevel: 1,
    requiredCharacterLevel: 1,
    baseSeconds: 10,
    xpPerUnit: 10,
    yieldPerUnit: 1,
    recipeLocked: false,
    inputs: [],
    ...patch,
  };
}

function content(patch: Partial<BalanceContent>): BalanceContent {
  return {
    resources: [],
    expeditionTiers: [],
    expeditionAreas: [],
    seeds: [],
    gardenTiles: 36,
    dungeons: [],
    quests: [],
    locations: [],
    items: [],
    rarities: [],
    statGrowth: getDefaultStatGrowthRules(),
    vocationMaxSeconds: 8 * 3_600,
    ...patch,
  };
}

const flat = buildCurve(design({ firstLevelXp: 3_600, power: 0, maxLevel: 50 }));

void test("a single skill levels exactly when its XP says it should", () => {
  // 10 XP every 10 s = 3,600 XP/h, and every level costs 3,600 XP.
  const result = simulateJourney({
    content: content({ resources: [resource({})] }),
    curves: { character: flat, skill: flat },
    profile: { hoursPerDay: 10, checkInsPerDay: 3 },
    plan: { groups: ["WOODCUTTING"], strategy: "split", garden: false, quests: false },
    options: DEFAULT_SOURCE_OPTIONS,
    days: 3,
  });
  // Level 11 after 10 hours = the end of day 1 (index 0).
  assert.equal(dayReached(result, "WOODCUTTING", 11), 1);
  assert.equal(result.reachedHours.WOODCUTTING[11], 10);
  assert.equal(result.levelAtDay.WOODCUTTING[3], 31);
  assert.equal(result.levelAtDay.CHARACTER[3], 31);
  assert.equal(result.segments.length, 1);
  assert.ok(Math.abs(result.playedHours - 30) < 1e-9);
});

void test("gates follow skill level and the character level of the location", () => {
  const data = content({
    resources: [
      resource({}),
      resource({ id: 2, name: "Oak", itemId: 101, requiredSkillLevel: 5, xpPerUnit: 20 }),
      resource({ id: 3, name: "Far", itemId: 102, requiredCharacterLevel: 40, xpPerUnit: 99 }),
      resource({ id: 4, name: "Nowhere", itemId: 103, requiredCharacterLevel: null, xpPerUnit: 99 }),
    ],
  });
  const at = (skill: number, character: number) =>
    groupSources(data, "WOODCUTTING", (track) => (track === "CHARACTER" ? character : skill), DEFAULT_SOURCE_OPTIONS)
      .map((source) => source.name)
      .sort();
  assert.deepEqual(at(1, 1), ["Log"]);
  assert.deepEqual(at(5, 1), ["Log", "Oak"]);
  assert.deepEqual(at(5, 40), ["Far", "Log", "Oak"]);
});

void test("self-gathered materials add their time and their skill's XP", () => {
  const data = content({
    resources: [
      resource({ id: 1, skill: "MINING", itemId: 100, baseSeconds: 10, xpPerUnit: 5 }),
      resource({
        id: 2,
        skill: "BLACKSMITHING",
        name: "Ingot",
        itemId: 200,
        baseSeconds: 20,
        xpPerUnit: 30,
        inputs: [{ itemId: 100, quantity: 2 }, { itemId: 999, quantity: 1 }],
      }),
    ],
  });
  const [bought] = groupSources(data, "BLACKSMITHING", ANY_LEVEL, DEFAULT_SOURCE_OPTIONS);
  assert.equal(bought!.seconds, 20);
  assert.deepEqual(bought!.bought, [100, 999]);
  const [gathered] = groupSources(data, "BLACKSMITHING", ANY_LEVEL, {
    ...DEFAULT_SOURCE_OPTIONS,
    materials: "gathered",
  });
  assert.equal(gathered!.seconds, 40); // 20 s + 2 × 10 s of mining
  assert.equal(gathered!.xp.MINING, 10);
  assert.equal(gathered!.xp.CHARACTER, 40);
  assert.deepEqual(gathered!.bought, [999]);
  // Efficiency speeds up the mining part only (100 halves it).
  const [fast] = groupSources(data, "BLACKSMITHING", ANY_LEVEL, {
    ...DEFAULT_SOURCE_OPTIONS,
    materials: "gathered",
    efficiency: 100,
  });
  assert.equal(fast!.seconds, 30);
});

void test("short runs only fill the day when the player checks in often", () => {
  const data = content({
    dungeons: [
      {
        id: 1,
        name: "Crypt",
        locationName: "Here",
        requiredLevel: 1,
        seconds: 900,
        xp: 100,
        packSize: 1,
        monsters: [],
      },
    ],
  });
  const run = (checkInsPerDay: number) =>
    simulateJourney({
      content: data,
      curves: { character: flat, skill: flat },
      profile: { hoursPerDay: 12, checkInsPerDay },
      plan: { groups: ["DUNGEONS"], strategy: "split", garden: false, quests: false },
      options: DEFAULT_SOURCE_OPTIONS,
      days: 1,
    });
  assert.ok(Math.abs(run(3).hoursByGroup.DUNGEONS! - 0.75) < 1e-9);
  assert.ok(Math.abs(run(3).idleHours - 11.25) < 1e-9);
  assert.ok(Math.abs(run(96).hoursByGroup.DUNGEONS! - 12) < 1e-9);
});

void test("split time goes where it can be used; XP what-ifs and quests apply", () => {
  const data = content({
    resources: [resource({})],
    dungeons: [
      { id: 1, name: "Crypt", locationName: "Here", requiredLevel: 1, seconds: 900, xp: 100, packSize: 1, monsters: [] },
    ],
    quests: [
      { id: 1, name: "Welcome", npcName: "Ada", requiredLevel: 1, xp: 3_600, repeat: "ONCE" },
      { id: 2, name: "Chores", npcName: "Ada", requiredLevel: 1, xp: 1, repeat: "DAILY" },
    ],
  });
  const result = simulateJourney({
    content: data,
    curves: { character: flat, skill: flat },
    profile: { hoursPerDay: 10, checkInsPerDay: 2 },
    plan: { groups: ["WOODCUTTING", "DUNGEONS"], strategy: "split", garden: false, quests: true },
    options: { ...DEFAULT_SOURCE_OPTIONS, xpScale: { WOODCUTTING: 2 } },
    days: 2,
  });
  assert.ok(Math.abs(result.hoursByGroup.DUNGEONS! - 1) < 1e-9);
  assert.ok(Math.abs(result.hoursByGroup.WOODCUTTING! - 19) < 1e-9);
  assert.equal(result.characterXpBySource.QUESTS, 3_602);
  // 19 h × 7,200 XP/h at double XP.
  assert.equal(result.levelAtDay.WOODCUTTING[2], 39);
});

void test("the garden pays per replant, capped by grow time and check-ins", () => {
  const data = content({
    seeds: [
      { itemId: 1, name: "Fast", xp: 10, growSeconds: 4 * 3_600, harvestSeconds: 5 },
      { itemId: 2, name: "Slow", xp: 50, growSeconds: 12 * 3_600, harvestSeconds: 5 },
    ],
  });
  // 3 check-ins: Fast = 36 × 10 × 3, Slow = 36 × 50 × 2.
  assert.equal(gardenPlan(data, DEFAULT_SOURCE_OPTIONS, 3)!.seedName, "Slow");
  assert.equal(gardenPlan(data, DEFAULT_SOURCE_OPTIONS, 3)!.xpPerDay, 3_600);
  // Unlimited check-ins: Fast = 36 × 10 × 6 = 2,160 < Slow's 3,600.
  assert.equal(gardenPlan(data, DEFAULT_SOURCE_OPTIONS, 96)!.xpPerDay, 3_600);
});

void test("expeditions need a reachable area and pick the best tier", () => {
  const data = content({
    expeditionTiers: [
      { id: 1, skill: "HUNTING", label: "1 hour", seconds: 3_600, xp: 25, requiredSkillLevel: 1 },
      { id: 2, skill: "HUNTING", label: "4 hours", seconds: 14_400, xp: 116, requiredSkillLevel: 1 },
    ],
    expeditionAreas: [
      { skill: "HUNTING", name: "Field", requiredSkillLevel: 1, requiredCharacterLevel: 1 },
    ],
  });
  const sources = groupSources(data, "HUNTING", ANY_LEVEL, DEFAULT_SOURCE_OPTIONS);
  assert.equal(sources.length, 2);
  assert.equal(xpPerHour(sources[1]!, "HUNTING"), 29);
  assert.equal(
    groupSources(content({ expeditionTiers: data.expeditionTiers }), "HUNTING", ANY_LEVEL, DEFAULT_SOURCE_OPTIONS).length,
    0,
  );
});

void test("garden XP arrives as the day ends, not when it starts", () => {
  const data = content({
    seeds: [{ itemId: 1, name: "Slow", xp: 100, growSeconds: 12 * 3_600, harvestSeconds: 5 }],
  });
  const result = simulateJourney({
    content: data,
    curves: { character: flat, skill: flat },
    profile: { hoursPerDay: 10, checkInsPerDay: 3 },
    plan: { groups: [], strategy: "split", garden: true, quests: false },
    options: DEFAULT_SOURCE_OPTIONS,
    days: 2,
  });
  // 36 tiles × 100 XP × 2 replants = 7,200 XP = two flat levels a day.
  assert.equal(dayReached(result, "GARDENING", 2), 1);
  assert.equal(result.levelAtDay.GARDENING[1], 3);
  assert.equal(result.levelAtDay.CHARACTER[2], 5);
});

void test("unlocks list every gate on the track that opens it", () => {
  const data = content({
    resources: [
      resource({ requiredSkillLevel: 5 }),
      resource({ id: 2, itemId: 101, requiredCharacterLevel: null }),
    ],
    locations: [
      { id: 1, name: "Town", requiredLevel: 1, gatheringEnabled: false, gatheringRequiredLevel: 1 },
      { id: 2, name: "Peaks", requiredLevel: 40, gatheringEnabled: false, gatheringRequiredLevel: 1 },
    ],
  });
  const unlocks = contentUnlocks(data);
  assert.deepEqual(
    unlocks.map((unlock) => `${unlock.track}:${unlock.level}:${unlock.name}`),
    ["CHARACTER:1:Town", "WOODCUTTING:5:Log", "CHARACTER:40:Peaks"],
  );
  assert.deepEqual(unlocksByLevel(unlocks, "CHARACTER").map(([level]) => level), [1, 40]);
});

void test("auto gear takes the strongest item a level may wear", () => {
  const weapon = (id: number, requiredLevel: number, damage: number, twoHanded = false): BalanceItem => ({
    id,
    name: `Weapon ${id}`,
    requiredLevel,
    itemType: null,
    equipTo: "weapon",
    twoHanded,
    balance: {
      flip: false,
      stats: [
        { statType: "PHYSICAL_DAMAGE_MIN", value: damage, maxValue: null },
        { statType: "PHYSICAL_DAMAGE_MAX", value: damage, maxValue: null },
      ],
      progressions: [],
      overrides: [],
    },
  });
  const shield: BalanceItem = {
    id: 9,
    name: "Shield",
    requiredLevel: 1,
    itemType: null,
    equipTo: "offhand",
    twoHanded: false,
    balance: { flip: false, stats: [{ statType: "ARMOR", value: 5, maxValue: null }], progressions: [], overrides: [] },
  };
  const data = content({ items: [weapon(1, 1, 5), weapon(2, 10, 20), weapon(3, 20, 50, true), shield] });
  const common = { rarity: "COMMON" as const, multiplier: 1 };
  const names = (level: number) => gearForLevel(data, level, common).map((piece) => piece.item.name);
  assert.deepEqual(names(5), ["Weapon 1", "Shield"]);
  assert.deepEqual(names(15), ["Weapon 2", "Shield"]);
  // A two-handed weapon leaves the off hand empty.
  assert.deepEqual(names(25), ["Weapon 3"]);
  const bare = combatAtLevel(data, 25, []);
  const armed = combatAtLevel(data, 25, gearForLevel(data, 25, common));
  assert.equal(armed.physicalDamageMax - bare.physicalDamageMax, 50);
});

void test("curve caches serve the stale copy while reloading, and invalidate at once", async () => {
  let loads = 0;
  const cache = refreshingCache(async () => {
    loads += 1;
    return loads;
  }, -1);
  assert.equal(await cache(), 1);
  // Expired: this call still answers with the stale value and reloads behind it.
  assert.equal(await cache(), 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await cache(), 2);
  cache.invalidate();
  assert.equal(await cache(), 4);
});

void test("the steepest growth or power that still fits the max level is found", () => {
  const steep = design({ growthPercent: 2 });
  assert.ok(buildCurve(steep).maxLevel < steep.maxLevel);
  const growth = largestFitting(steep, "growthPercent", 0.05)!;
  assert.ok(growth > 0 && growth < 2);
  assert.equal(buildCurve({ ...steep, growthPercent: growth }).maxLevel, steep.maxLevel);
  assert.ok(buildCurve({ ...steep, growthPercent: growth + 0.05 }).maxLevel < steep.maxLevel);
  // A design that already fits keeps its value.
  assert.equal(largestFitting(DEFAULT_CURVE_DESIGNS.CHARACTER, "power", 0.05), 1.5);
  // When a band alone overflows, no growth value can fix it.
  const walled = design({ bands: [{ fromLevel: 2, toLevel: 2_000, multiplier: 1_000 }], power: 3 });
  assert.equal(largestFitting({ ...walled, growthPercent: 1 }, "growthPercent", 0.05), null);
});
