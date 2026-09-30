/**
 * One-off content rebalance: gives every equippable item, monster, dungeon
 * and hunting ground real numbers from the budgets in src/game/balance/
 * budget.ts, spread across character levels 1-340.
 *
 *   node --import tsx scripts/rebalanceGear.ts            # plan + simulations
 *   node --import tsx scripts/rebalanceGear.ts --apply    # also write the DB
 *
 * The plan is written to prisma/rebalance/plan.json. --apply first saves
 * every row it changes to prisma/rebalance/backup-<time>.json. Tools,
 * backpacks, recipes and drop tables are left alone.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ItemEquipTo,
  StatType,
  type DungeonDifficulty,
  type ItemRarity,
  type ItemType,
} from "../src/generated/prisma/enums";
import {
  accidentDamage,
  animalDamage,
  armorSetBudget,
  budgetItemStats,
  MATERIAL,
  monsterBudget,
  referenceCharacter,
  weaponBudget,
  type BudgetContext,
  type BudgetedStat,
  type ItemProfile,
  type MonsterRank,
} from "../src/game/balance/budget";
import {
  armorConstant,
  DEFAULT_COMBAT_CONFIG,
  strikeRulesFor,
  type CombatConfig,
} from "../src/server/combat/rules";
import {
  combatSnapshotFromStats,
  dungeonCombatRules,
  resolveDungeonRun,
  type DungeonCombatSnapshot,
  type DungeonMonsterPoolEntry,
} from "../src/server/dungeons/resolver";
import { resolveHuntingExpedition } from "../src/server/hunting/resolver";
import { createExpeditionRandom } from "../src/server/expeditions/random";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";
import {
  aggregateStatValues,
  calculateFinalStatsFromTotals,
  calculateLevelBaseStats,
  combineStatRecords,
  getDefaultStatGrowthRules,
  weaponAttackSpeedAdjustment,
  type StatGrowthRule,
} from "../src/utils/stats";

const APPLY = process.argv.includes("--apply");
const OUT_DIR = new URL("../prisma/rebalance/", import.meta.url);
const XP_CURVE = { firstLevelXp: 22, power: 1.45 }; // live CHARACTER design

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

// ---------------------------------------------------------------------------
// The tier map. Levels follow the world: starter towns (1), Goblins Camp
// (40), Frostcrown Peaks (50-120), Mount Doom and Sunscar Badlands (150-180),
// Pirate Island (200), Dreadspire Reach (250-300), and 340 at the top. The
// gaps between tiers are left for future gear. Dungeons start at 35: players
// gear up in the open world first.
// ---------------------------------------------------------------------------

type ItemPlan = {
  level: number;
  /** Armor pieces only. */
  material?: number;
  /** Weapons: keep this speed (else the item's own, else the type's). */
  attackSpeed?: number;
  /** Secondary stats with weights; defaults to the item's own stats. */
  stats?: Partial<Record<StatType, number>>;
  equipTo?: ItemEquipTo;
  itemType?: ItemType;
  note?: string;
};

const heavy = MATERIAL.heavy;
const medium = MATERIAL.medium;
const light = MATERIAL.light;

const ITEM_PLAN: Record<string, ItemPlan> = {
  // Weapons
  "Wooden Sword": { level: 1 },
  "Wooden Dagger": { level: 1 },
  "Wooden Axe": { level: 1 },
  "Wooden Mace": { level: 1 },
  "Tin Sword": { level: 5, attackSpeed: 1 },
  "Wayfarer Shortblade": { level: 10 },
  "Bearded Greataxe": {
    level: 20,
    attackSpeed: 0.7,
    note: "Had no speed of its own, so it swung at the unarmed 1.0.",
  },
  Briarcleaver: { level: 30 },
  "Ogre Cleaver": {
    level: 100,
    note: "Dropped by the Ogre in Blackjaw Stockade (100).",
  },
  "Reedwind Bow": { level: 60 },
  Cindermaul: { level: 120 },
  "Silver Revolver": { level: 200 },
  "Duskglass Staff": {
    level: 260,
    stats: { [StatType.CRITICAL_CHANCE]: 1 },
    note: "Mana removed; its secondary budget goes to critical chance.",
  },
  "Embervein Sword": { level: 340 },

  // Off hand
  Buckler: { level: 1, stats: { [StatType.PHYSICAL_DAMAGE_MIN]: 1 } },
  "Iron Shield": {
    level: 25,
    equipTo: ItemEquipTo.offhand,
    itemType: "SHIELD",
    stats: { [StatType.HEALTH]: 1, [StatType.PHYSICAL_DAMAGE_MIN]: 0.5 },
    note: "Was a sword in the weapon slot; now an off-hand shield.",
  },

  // Armor sets and pieces
  ...set(
    [
      "Trailwarden Helm",
      "Trailwarden Jerkin",
      "Trailwarden Pauldrons",
      "Trailwarden Bracers",
      "Trailwarden Gloves",
      "Trailwarden Belt",
      "Trailwarden Greaves",
      "Trailwarden Boots",
    ],
    { level: 1, material: heavy },
  ),
  "Leather Belt": { level: 5, material: medium },
  ...set(["Gold Helmet", "Gold Chestplate", "Gold Gloves", "Gold Boots"], {
    level: 15,
    material: heavy,
  }),
  "Fieldweave Gloves": { level: 1, material: light },
  "Fieldweave Trailboots": { level: 3, material: light },
  "Fieldweave Leggings": { level: 7, material: light },
  "Fieldweave Tunic": { level: 12, material: light },
  ...set(
    [
      "Mossweave Hood",
      "Mossweave Vest",
      "Mossweave Mantle",
      "Mossweave Bracers",
      "Mossweave Gloves",
      "Mossweave Trousers",
      "Mossweave Trailboots",
      "Mossweave Utility Belt",
    ],
    { level: 30, material: light },
  ),
  ...set(
    [
      "Ironbark Helm",
      "Ironbark Cuirass",
      "Ironbark Pauldrons",
      "Ironbark Bracers",
      "Ironbark Gauntlets",
      "Ironbark Greaves",
      "Ironbark Sabatons",
      "Ironbark Girdle",
    ],
    { level: 40, material: heavy },
  ),
  ...set(
    [
      "Frostsilver Helm",
      "Frostsilver Cuirass",
      "Frostsilver Pauldrons",
      "Frostsilver Bracers",
      "Frostsilver Gauntlets",
      "Frostsilver Greaves",
      "Frostsilver Sabatons",
      "Frostsilver Girdle",
    ],
    { level: 100, material: medium },
  ),
  "Dragonscale Shoulder Pads": { level: 150, material: heavy },
  ...set(
    [
      "Cinderweave Cowl",
      "Cinderweave Coat",
      "Cinderweave Mantle",
      "Cinderweave Wraps",
      "Cinderweave Gloves",
      "Cinderweave Leggings",
      "Cinderweave Ashboots",
      "Cinderweave Sash",
    ],
    { level: 180, material: 0.7 },
  ),
  ...set(
    [
      "Duskwarden Helm",
      "Duskwarden Cuirass",
      "Duskwarden Pauldrons",
      "Duskwarden Vambraces",
      "Duskwarden Gauntlets",
      "Duskwarden Girdle",
      "Duskwarden Greaves",
      "Duskwarden Sabatons",
    ],
    { level: 300, material: heavy },
  ),

  // Jewelry
  "Ironroot Band": { level: 1 },
  "Pilgrim's Bronze Ankh": { level: 1 },
  "Tinker's Brass Signet": { level: 10 },
  "Rowan Bead Necklace": {
    level: 10,
    stats: { [StatType.MAGIC_RESIST]: 1, [StatType.HEALTH_REGEN]: 1 },
    note: "Had only Mana and Mana Regen; now a warding charm.",
  },
  "Gold Ring": { level: 15 },
  "Gold Amulet": { level: 15 },
  "Gold Necklace": { level: 15 },
  "Fordstone Talisman": { level: 60 },
  "Diamond Ring": { level: 240 },
};

/** Tools and backpacks keep their numbers. */
const UNCHANGED = new Set([
  "Simple Felling Axe",
  "Iron Pickaxe",
  "Basic Fishing Rod",
  "XL Backpack",
  "Traveler's Backpack",
]);

function set(names: string[], plan: ItemPlan): Record<string, ItemPlan> {
  return Object.fromEntries(names.map((name) => [name, plan]));
}

/** Stats that leave gear: Mana is removed, XP boosts are XpMultiplier rows. */
const DROPPED_STATS: ReadonlySet<StatType> = new Set([
  StatType.MANA,
  StatType.MANA_REGEN,
  StatType.EXPERIENCE_GAIN,
]);

type MonsterPlan = { level: number; rank: MonsterRank };

const MONSTER_PLAN: Record<string, MonsterPlan> = {
  Goblin: { level: 35, rank: "normal" },
  "Bomber Goblin": { level: 60, rank: "normal" },
  "Tunnel goblin": { level: 100, rank: "normal" },
  Orc: { level: 100, rank: "normal" },
  Warg: { level: 100, rank: "normal" },
  Ogre: { level: 105, rank: "elite" },
  Trollhound: { level: 180, rank: "normal" },
  "Cave Troll": { level: 185, rank: "boss" },
  "Stoneback Troll": { level: 305, rank: "boss" },
  // Not in any dungeon yet: ready for dungeons in the gaps.
  "Puddle Slime": { level: 45, rank: "normal" },
  "Mire ooze": { level: 80, rank: "normal" },
  Bat: { level: 130, rank: "normal" },
  "Carrion Hound": { level: 150, rank: "normal" },
  "Cavefang Spider": { level: 230, rank: "normal" },
  "Rattlebone Skeleton": { level: 260, rank: "normal" },
};

/**
 * Dungeons start at level 35 and last 2-6 hours. Keyed by dungeon id, since
 * two share the name Gloamvault.
 */
const DUNGEON_PLAN: Record<
  number,
  { level: number; hours: number; difficulty: DungeonDifficulty }
> = {
  3: { level: 35, hours: 2, difficulty: "NORMAL" }, // Gloamvault, Crownhold
  1: { level: 60, hours: 3, difficulty: "NORMAL" }, // Gloamvault, Valedor
  5: { level: 100, hours: 4, difficulty: "HARD" }, // Blackjaw Stockade
  4: { level: 180, hours: 5, difficulty: "HARD" }, // Drowned Mouth Grotto
  2: { level: 300, hours: 6, difficulty: "DEADLY" }, // Trollbreaker Cavern
};

/**
 * Chance an on-level reference character (on-level Rare gear) clears a
 * dungeon. Below certain on purpose: players should weigh their gear and
 * level before entering, and overgearing pays off.
 */
const SURVIVAL_TARGET = { normal: 0.75, boss: 0.65 };

// ---------------------------------------------------------------------------

type Stat = { statType: StatType; value: number; maxValue: number | null };

const round2 = (value: number) => Math.round(value * 100) / 100;

function xpStep(level: number) {
  return XP_CURVE.firstLevelXp * Math.pow(level, XP_CURVE.power);
}

/**
 * Dungeon XP per hour: 2.5 times what the best vocations pay around that
 * level (about 1,300 + 6 × level per hour in the live content), for the risk.
 */
function dungeonXp(level: number, seconds: number) {
  return Math.round(2.5 * (1_300 + 6 * level) * (seconds / 3_600));
}

function defaultIntents(stats: Stat[], equipTo: ItemEquipTo) {
  const intents: Partial<Record<StatType, number>> = {};
  const isArmorPiece =
    equipTo !== ItemEquipTo.weapon &&
    equipTo !== ItemEquipTo.offhand &&
    equipTo !== ItemEquipTo.ring &&
    equipTo !== ItemEquipTo.amulet &&
    equipTo !== ItemEquipTo.necklace;
  for (const { statType } of stats) {
    if (DROPPED_STATS.has(statType)) continue;
    if (statType === StatType.ATTACK_SPEED) continue;
    if (statType === StatType.PHYSICAL_DAMAGE_MAX) continue;
    if (statType === StatType.MAGIC_DAMAGE_MAX) continue;
    if (equipTo === ItemEquipTo.weapon) {
      if (
        statType === StatType.PHYSICAL_DAMAGE_MIN ||
        statType === StatType.MAGIC_DAMAGE_MIN
      ) {
        continue;
      }
    }
    if (isArmorPiece && statType === StatType.ARMOR) continue;
    intents[statType] = 1;
  }
  return intents;
}

async function main() {
  const [
    items,
    creatures,
    dungeons,
    grounds,
    durations,
    growthRows,
    rarities,
    combatRow,
    huntingConfig,
  ] = await Promise.all([
    prisma.item.findMany({
      where: { equipTo: { not: null } },
      include: {
        stats: { select: { statType: true, value: true, maxValue: true } },
        statProgressions: true,
        statRarityOverrides: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.creature.findMany({ orderBy: { id: "asc" } }),
    prisma.dungeon.findMany({
      include: {
        monsters: true,
        location: { select: { name: true, requiredLevel: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.huntingGround.findMany({
      include: {
        location: { select: { name: true, requiredLevel: true } },
        creatures: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.huntingDuration.findMany({
      where: { enabled: true },
      orderBy: { durationSeconds: "asc" },
    }),
    prisma.characterStatGrowth.findMany(),
    prisma.rarityConfig.findMany(),
    prisma.combatConfig.findUnique({ where: { id: 1 } }).catch(() => null),
    prisma.huntingConfig.findUnique({ where: { id: 1 } }),
  ]);

  // Growth rules as they will be: live rows plus this plan's two changes.
  const growth: Record<StatType, StatGrowthRule> = getDefaultStatGrowthRules();
  for (const row of growthRows) {
    growth[row.statType] = {
      baseValue: row.baseValue,
      perLevel: row.perLevel,
      maxBonus: row.maxBonus,
    };
  }
  const growthChanges: Array<{
    statType: StatType;
    before: StatGrowthRule;
    after: StatGrowthRule;
  }> = [
    {
      statType: StatType.MAGIC_RESIST,
      before: { ...growth.MAGIC_RESIST },
      after: { baseValue: 0, perLevel: 0.1, maxBonus: 10 },
    },
    {
      statType: StatType.ATTACK_SPEED,
      before: { ...growth.ATTACK_SPEED },
      after: {
        baseValue: growth.ATTACK_SPEED.baseValue,
        perLevel: 0,
        maxBonus: null,
      },
    },
  ];
  for (const change of growthChanges) growth[change.statType] = change.after;

  const combat: CombatConfig = combatRow
    ? { armorK0: combatRow.armorK0, armorK1: combatRow.armorK1 }
    : DEFAULT_COMBAT_CONFIG;
  const ctx: BudgetContext = { combat, growth };
  const rarityMultiplier = new Map<ItemRarity, number>(
    rarities.map((row) => [row.rarity, row.statMultiplier]),
  );

  // --- Items -----------------------------------------------------------
  const missing = Object.keys(ITEM_PLAN).filter(
    (name) => !items.some((item) => item.name === name),
  );
  if (missing.length)
    throw new Error(`Planned items not found: ${missing.join(", ")}`);
  const unplanned = items.filter(
    (item) => !ITEM_PLAN[item.name] && !UNCHANGED.has(item.name),
  );
  if (unplanned.length) {
    throw new Error(
      `Items without a plan: ${unplanned.map((i) => i.name).join(", ")}`,
    );
  }

  const itemPlans = items
    .filter((item) => ITEM_PLAN[item.name])
    .map((item) => {
      const plan = ITEM_PLAN[item.name]!;
      const equipTo = plan.equipTo ?? item.equipTo!;
      const itemType = plan.itemType ?? item.itemType;
      const ownSpeed = item.stats.find(
        (stat) => stat.statType === StatType.ATTACK_SPEED,
      )?.value;
      const profile: ItemProfile = {
        level: plan.level,
        equipTo,
        itemType,
        twoHanded: item.twoHanded,
        material: plan.material,
        attackSpeed:
          equipTo === ItemEquipTo.weapon
            ? plan.attackSpeed ?? ownSpeed
            : undefined,
        magic: item.stats.some(
          (stat) =>
            stat.statType === StatType.MAGIC_DAMAGE_MIN && stat.value > 0,
        )
          ? equipTo === ItemEquipTo.weapon
          : undefined,
        stats: plan.stats ?? defaultIntents(item.stats, equipTo),
      };
      const after = budgetItemStats(profile, ctx);
      return { item, plan, equipTo, itemType, profile, after };
    });

  // --- Monsters and animals ---------------------------------------------
  /** A monster's stats at its level and rank, its damage scaled by `scale`. */
  function monsterAfter(
    creature: (typeof creatures)[number],
    plan: MonsterPlan,
    scale: number,
  ) {
    const budget = monsterBudget(plan.level, plan.rank, ctx);
    const parts = [
      ["damage", creature.damageMin, creature.damageMax],
      ["magicDamage", creature.magicDamageMin, creature.magicDamageMax],
      [
        "elementalDamage",
        creature.elementalDamageMin,
        creature.elementalDamageMax,
      ],
    ] as const;
    // Keep the monster's mix of physical, magic and elemental damage.
    const averages = parts.map(([, min, max]) => (min + max) / 2);
    const total = averages.reduce((sum, value) => sum + value, 0);
    const ranges = Object.fromEntries(
      parts.map(([key, min, max], index) => {
        const share =
          total > 0 ? averages[index]! / total : index === 0 ? 1 : 0;
        const average = budget.damage * scale * share;
        if (average <= 0) return [key, [0, 0]];
        const spread = Math.max(
          0.1,
          max + min > 0 ? Math.min(0.5, (max - min) / (max + min)) : 0.2,
        );
        const low = Math.max(1, Math.round(average * (1 - spread)));
        const high = Math.max(low, Math.round(average * (1 + spread)));
        return [key, [low, high]];
      }),
    ) as Record<"damage" | "magicDamage" | "elementalDamage", [number, number]>;
    return {
      health: Math.round(budget.health),
      armor: Math.round(budget.armor),
      magicResist: Math.min(75, creature.magicResist),
      damageMin: ranges.damage[0],
      damageMax: ranges.damage[1],
      magicDamageMin: ranges.magicDamage[0],
      magicDamageMax: ranges.magicDamage[1],
      elementalDamageMin: ranges.elementalDamage[0],
      elementalDamageMax: ranges.elementalDamage[1],
    };
  }

  const monsterPlans = creatures
    .filter((creature) => MONSTER_PLAN[creature.name])
    .map((creature) => {
      const plan = MONSTER_PLAN[creature.name]!;
      return {
        creature,
        plan,
        scale: 1,
        after: monsterAfter(creature, plan, 1),
      };
    });

  // An animal's home is the lowest location level it roams, so it never
  // overwhelms its easiest ground.
  const animalHome = new Map<number, number>();
  for (const ground of grounds.filter((row) => row.enabled)) {
    for (const row of ground.creatures.filter((entry) => entry.enabled)) {
      const level = Math.max(1, ground.location.requiredLevel);
      animalHome.set(
        row.creatureId,
        Math.min(animalHome.get(row.creatureId) ?? Infinity, level),
      );
    }
  }
  const animalPlans = creatures
    .filter(
      (creature) => creature.kind === "ANIMAL" && animalHome.has(creature.id),
    )
    .map((creature) => {
      const home = animalHome.get(creature.id)!;
      const average = animalDamage(home, creature.attackChance, ctx);
      return {
        creature,
        home,
        after: {
          damageMin: Math.max(1, Math.round(average * 0.7)),
          damageMax: Math.max(1, Math.round(average * 1.3)),
        },
      };
    });

  const groundPlans = grounds.map((ground) => {
    const level = Math.max(1, ground.location.requiredLevel);
    const average = accidentDamage(level, ctx);
    return {
      ground,
      level,
      after: {
        accidentDamageMin: Math.max(1, Math.round(average * 0.6)),
        accidentDamageMax: Math.max(1, Math.round(average * 1.4)),
      },
    };
  });

  const unplannedDungeons = dungeons.filter((row) => !DUNGEON_PLAN[row.id]);
  if (unplannedDungeons.length) {
    throw new Error(
      `Dungeons without a plan: ${unplannedDungeons.map((row) => `${row.id} ${row.name}`).join(", ")}`,
    );
  }
  const dungeonPlans = dungeons.map((dungeon) => {
    const plan = DUNGEON_PLAN[dungeon.id]!;
    const durationSeconds = plan.hours * 3_600;
    return {
      dungeon,
      after: {
        requiredLevel: plan.level,
        durationSeconds,
        difficulty: plan.difficulty,
        xpReward: dungeonXp(plan.level, durationSeconds),
      },
    };
  });

  // --- Simulations ---------------------------------------------------------
  const creatureAfter = new Map([
    ...monsterPlans.map(
      (row) => [row.creature.id, { ...row.creature, ...row.after }] as const,
    ),
    ...animalPlans.map(
      (row) => [row.creature.id, { ...row.creature, ...row.after }] as const,
    ),
  ]);
  const creatureNow = (id: number) =>
    creatureAfter.get(id) ?? creatures.find((row) => row.id === id)!;

  const wornStats = (plan: (typeof itemPlans)[number]) =>
    resolveEffectiveItemStats({
      rarity: plan.item.rarity,
      rarityMultiplier: rarityMultiplier.get(plan.item.rarity) ?? 1,
      flipNegativeStatsWithRarity: plan.item.flipNegativeStatsWithRarity,
      equipTo: plan.equipTo,
      stats: plan.after,
    });

  const damagePerRound = (
    stats: Array<{ statType: StatType; value: number }>,
  ) => {
    const get = (type: StatType) =>
      stats.find((stat) => stat.statType === type)?.value ?? 0;
    return (
      ((get(StatType.PHYSICAL_DAMAGE_MIN) + get(StatType.PHYSICAL_DAMAGE_MAX)) /
        2 +
        (get(StatType.MAGIC_DAMAGE_MIN) + get(StatType.MAGIC_DAMAGE_MAX)) / 2) *
      (get(StatType.ATTACK_SPEED) || 1)
    );
  };

  /** The best gear from this plan a character of `level` can wear. */
  function bestGear(level: number) {
    const usable = itemPlans.filter((row) => row.plan.level <= level);
    const bySlot = new Map<ItemEquipTo, typeof usable>();
    for (const row of usable) {
      const list = bySlot.get(row.equipTo) ?? [];
      list.push(row);
      bySlot.set(row.equipTo, list);
    }
    const pick = (
      slot: ItemEquipTo,
      score: (row: (typeof usable)[number]) => number,
      count = 1,
    ) =>
      [...(bySlot.get(slot) ?? [])]
        .sort((a, b) => score(b) - score(a) || b.plan.level - a.plan.level)
        .slice(0, count);
    const armorOf = (row: (typeof usable)[number]) =>
      wornStats(row).find((stat) => stat.statType === StatType.ARMOR)?.value ??
      0;
    const combatScore = (row: (typeof usable)[number]) =>
      armorOf(row) +
      (wornStats(row).find((stat) => stat.statType === StatType.HEALTH)
        ?.value ?? 0) *
        0.3;
    const weapon = pick(ItemEquipTo.weapon, (row) =>
      damagePerRound(wornStats(row)),
    )[0];
    const chosen = [
      ...(weapon ? [weapon] : []),
      ...(!weapon?.item.twoHanded
        ? pick(ItemEquipTo.offhand, combatScore)
        : []),
      ...[
        ItemEquipTo.head,
        ItemEquipTo.chest,
        ItemEquipTo.pauldrons,
        ItemEquipTo.bracers,
        ItemEquipTo.gloves,
        ItemEquipTo.greaves,
        ItemEquipTo.boots,
        ItemEquipTo.belt,
        ItemEquipTo.amulet,
        ItemEquipTo.necklace,
      ].flatMap((slot) =>
        pick(slot, (row) => combatScore(row) + row.plan.level * 0.01),
      ),
      ...pick(
        ItemEquipTo.ring,
        (row) => combatScore(row) + row.plan.level * 0.01,
        2,
      ),
    ];
    return chosen;
  }

  function characterAt(
    level: number,
    gear: ReturnType<typeof bestGear>,
  ): DungeonCombatSnapshot {
    const base = calculateLevelBaseStats(level, growth);
    const pieces = gear.map((row) => ({ row, stats: wornStats(row) }));
    const equipment = aggregateStatValues(
      pieces.flatMap((piece) => piece.stats),
    );
    const weapon = pieces.find(
      (piece) => piece.row.equipTo === ItemEquipTo.weapon,
    );
    const offhand = pieces.find(
      (piece) => piece.row.equipTo === ItemEquipTo.offhand,
    );
    equipment[StatType.ATTACK_SPEED] += weaponAttackSpeedAdjustment(
      weapon?.stats,
      growth.ATTACK_SPEED.baseValue,
      offhand ? { equipTo: offhand.row.equipTo, stats: offhand.stats } : null,
    );
    return combatSnapshotFromStats(
      calculateFinalStatsFromTotals(combineStatRecords(base, equipment)),
    );
  }

  function referenceAt(level: number): DungeonCombatSnapshot {
    const reference = referenceCharacter(level, ctx);
    const base = calculateFinalStatsFromTotals(
      calculateLevelBaseStats(level, growth),
    );
    const weapon = 1.35 * weaponBudget(level);
    return {
      ...combatSnapshotFromStats(base),
      maxHealth: reference.health,
      physicalDamageMin: base.minPhysicalDamage + weapon * 0.8,
      physicalDamageMax: base.maxPhysicalDamage + weapon * 1.2,
      attackSpeed: 1,
      armor: reference.armor,
    };
  }

  /** A new player: base stats, a Common weapon of the level and no armor. */
  function newcomerAt(level: number): DungeonCombatSnapshot {
    const base = calculateFinalStatsFromTotals(
      calculateLevelBaseStats(level, growth),
    );
    const weapon = weaponBudget(level);
    return {
      ...combatSnapshotFromStats(base),
      physicalDamageMin: base.minPhysicalDamage + weapon * 0.8,
      physicalDamageMax: base.maxPhysicalDamage + weapon * 1.2,
      attackSpeed: 1,
    };
  }

  function simulateDungeon(
    plan: (typeof dungeonPlans)[number],
    combat: DungeonCombatSnapshot,
    seed: string,
    runs = 400,
    /** The character's own level; defaults to the dungeon's. */
    characterLevel?: number,
  ) {
    const level = Math.max(
      plan.after.requiredLevel,
      plan.dungeon.location.requiredLevel,
    );
    const pool: DungeonMonsterPoolEntry[] = plan.dungeon.monsters
      .filter((row) => row.enabled)
      .map((row) => {
        const creature = creatureNow(row.creatureId);
        return {
          creatureId: creature.id,
          name: creature.name,
          asset: creature.asset,
          minCount: row.minCount,
          maxCount: row.maxCount,
          attackStyle: creature.attackStyle,
          damageMin: creature.damageMin,
          damageMax: creature.damageMax,
          magicDamageMin: creature.magicDamageMin,
          magicDamageMax: creature.magicDamageMax,
          damageType: creature.damageType,
          elementalDamageMin: creature.elementalDamageMin,
          elementalDamageMax: creature.elementalDamageMax,
          critChance: creature.critChance,
          critDamage: creature.critDamage,
          health: creature.health,
          armor: creature.armor,
          magicResist: creature.magicResist,
          evasion: creature.evasion,
          blockChance: creature.blockChance,
          drops: [],
        };
      });
    const random = createExpeditionRandom(seed);
    let cleared = 0;
    let damage = 0;
    for (let run = 0; run < runs; run += 1) {
      const { report } = resolveDungeonRun({
        pool,
        combat,
        startingHealth: combat.maxHealth,
        packSize: plan.dungeon.packSize,
        deathRules: { keepChance: 0, quantityPercent: 0 },
        rules: dungeonCombatRules(level, characterLevel ?? level, ctx.combat),
        random,
      });
      if (report.outcome === "CLEARED") cleared += 1;
      damage += report.damageTaken;
    }
    return {
      survival: round2(cleared / runs),
      damageShare: round2(damage / runs / combat.maxHealth),
    };
  }

  // Each dungeon's own monsters (those of its level, not lower-level guests)
  // share one damage scale, found by binary search, so an on-level reference
  // character clears the dungeon SURVIVAL_TARGET of the time.
  const calibration: Array<{
    dungeon: string;
    level: number;
    target: number;
    scale: number;
    monsters: string[];
  }> = [];
  const calibrated = new Set<number>();
  // Lowest first, so a dungeon's weaker guests are already settled.
  const byLevel = [...dungeonPlans].sort(
    (a, b) => a.after.requiredLevel - b.after.requiredLevel,
  );
  for (const plan of byLevel) {
    const level = Math.max(
      plan.after.requiredLevel,
      plan.dungeon.location.requiredLevel,
    );
    const owned = monsterPlans.filter(
      (row) =>
        plan.dungeon.monsters.some(
          (entry) => entry.enabled && entry.creatureId === row.creature.id,
        ) &&
        row.plan.level >= level - 5 &&
        row.plan.level <= level + 10,
    );
    if (owned.length === 0) continue;
    const target = owned.some((row) => row.plan.rank === "boss")
      ? SURVIVAL_TARGET.boss
      : SURVIVAL_TARGET.normal;
    const setScale = (scale: number) => {
      for (const row of owned) {
        row.scale = scale;
        row.after = monsterAfter(row.creature, row.plan, scale);
        creatureAfter.set(row.creature.id, { ...row.creature, ...row.after });
      }
    };
    let low = 0.05;
    let high = 20;
    for (let step = 0; step < 18; step += 1) {
      const mid = Math.sqrt(low * high);
      setScale(mid);
      const { survival } = simulateDungeon(
        plan,
        referenceAt(level),
        `calibrate:${plan.dungeon.id}`,
        400,
      );
      if (survival < target) high = mid;
      else low = mid;
    }
    const scale = Math.round(Math.sqrt(low * high) * 1_000) / 1_000;
    setScale(scale);
    for (const row of owned) calibrated.add(row.creature.id);
    calibration.push({
      dungeon: `${plan.dungeon.name} (${plan.dungeon.location.name})`,
      level,
      target,
      scale,
      monsters: owned.map((row) => row.creature.name),
    });
  }
  // Monsters that aren't in a dungeon yet take the typical scale.
  const scales = calibration.map((row) => row.scale).sort((a, b) => a - b);
  const typicalScale = scales.length
    ? scales[Math.floor(scales.length / 2)]!
    : 1;
  for (const row of monsterPlans) {
    if (calibrated.has(row.creature.id) || row.plan.rank === "fodder") continue;
    row.scale = typicalScale;
    row.after = monsterAfter(row.creature, row.plan, typicalScale);
    creatureAfter.set(row.creature.id, { ...row.creature, ...row.after });
  }

  const dungeonChecks = dungeonPlans.map((plan) => {
    const level = Math.max(
      plan.after.requiredLevel,
      plan.dungeon.location.requiredLevel,
    );
    const gear = bestGear(level);
    return {
      id: plan.dungeon.id,
      name: plan.dungeon.name,
      location: plan.dungeon.location.name,
      level,
      reference: simulateDungeon(
        plan,
        referenceAt(level),
        `ref:${plan.dungeon.id}`,
      ),
      // The same reference character 10 and 25 levels higher.
      plus10: simulateDungeon(
        plan,
        referenceAt(level + 10),
        `plus10:${plan.dungeon.id}`,
        400,
        level + 10,
      ),
      plus25: simulateDungeon(
        plan,
        referenceAt(level + 25),
        `plus25:${plan.dungeon.id}`,
        400,
        level + 25,
      ),
      // A player who skipped armor: the first dungeon only.
      newcomer:
        level <= 40
          ? simulateDungeon(plan, newcomerAt(level), `new:${plan.dungeon.id}`)
          : null,
      bestGear: simulateDungeon(
        plan,
        characterAt(level, gear),
        `gear:${plan.dungeon.id}`,
      ),
      gear: gear.map((row) => row.item.name),
    };
  });

  const huntingChecks = groundPlans.map((plan) => {
    const level = plan.level;
    const reference = referenceAt(level);
    const pool = plan.ground.creatures
      .filter((row) => row.enabled && row.encounterWeight > 0)
      .map((row) => {
        const creature = creatureNow(row.creatureId);
        return {
          creatureId: creature.id,
          name: creature.name,
          asset: creature.asset,
          encounterWeight: row.encounterWeight,
          attackStyle: creature.attackStyle,
          damageMin: creature.damageMin,
          damageMax: creature.damageMax,
          magicDamageMin: creature.magicDamageMin,
          magicDamageMax: creature.magicDamageMax,
          damageType: creature.damageType,
          elementalDamageMin: creature.elementalDamageMin,
          elementalDamageMax: creature.elementalDamageMax,
          critChance: creature.critChance,
          critDamage: creature.critDamage,
          attackChance: creature.attackChance,
          drops: [
            {
              dropId: 0,
              itemId: 0,
              name: "sample",
              sprite: "",
              rarity: "COMMON" as ItemRarity,
              baseChance: 1,
              minQuantity: 1,
              maxQuantity: 1,
            },
          ],
        };
      });
    const byDuration = durations.map((duration) => {
      const random = createExpeditionRandom(
        `hunt:${plan.ground.id}:${duration.id}`,
      );
      let total = 0;
      const runs = 400;
      for (let run = 0; run < runs; run += 1) {
        total += resolveHuntingExpedition({
          pool,
          encounterRolls: duration.encounterRolls,
          quantityMultiplier: duration.quantityMultiplier,
          dangerMultiplier: duration.dangerMultiplier,
          globalDangerMultiplier: huntingConfig?.globalDangerMultiplier ?? 1,
          damageEnabled: true,
          maxHealthLossPercent: huntingConfig?.maxHealthLossPercent ?? 30,
          accidentChance: plan.ground.accidentChance,
          accidentDamageMin: plan.after.accidentDamageMin,
          accidentDamageMax: plan.after.accidentDamageMax,
          skillLevel: 1,
          luck: 0,
          huntingEfficiency: 0,
          defenses: {
            ...reference,
            movementSpeed: 100,
            maxHealth: reference.maxHealth,
          },
          rules: strikeRulesFor(level, ctx.combat),
          random,
        }).report.totalDamage;
      }
      return {
        label: duration.label,
        damageShare: round2(total / runs / reference.maxHealth),
      };
    });
    return {
      id: plan.ground.id,
      name: plan.ground.name,
      location: plan.ground.location.name,
      level,
      byDuration,
    };
  });

  // --- Budget table for the review -------------------------------------------
  const budgetLevels = [
    1, 15, 40, 60, 100, 120, 150, 180, 200, 240, 260, 300, 340,
  ];
  const budgets = budgetLevels.map((level) => {
    const reference = referenceCharacter(level, ctx);
    return {
      level,
      armorK: armorConstant(level, combat),
      armorSet: Math.round(armorSetBudget(level, ctx)),
      weapon: round2(weaponBudget(level)),
      referenceHealth: Math.round(reference.health),
      referenceDamage: Math.round(reference.damagePerRound),
      normalMonster: (() => {
        const monster = monsterBudget(level, "normal", ctx);
        return {
          health: Math.round(monster.health),
          damage: Math.round(monster.damage),
          armor: Math.round(monster.armor),
        };
      })(),
      xpShare: round2(xpTotal(level) / xpTotal(340)),
    };
  });

  const plan = {
    generatedAt: new Date().toISOString(),
    combat,
    growthChanges,
    items: itemPlans.map((row) => ({
      id: row.item.id,
      name: row.item.name,
      rarity: row.item.rarity,
      note: row.plan.note ?? null,
      before: {
        level: row.item.requiredLevel ?? 1,
        equipTo: row.item.equipTo,
        itemType: row.item.itemType,
        stats: row.item.stats,
      },
      after: {
        level: row.plan.level,
        equipTo: row.equipTo,
        itemType: row.itemType,
        stats: row.after,
        worn: wornStats(row),
      },
    })),
    monsters: monsterPlans.map((row) => ({
      id: row.creature.id,
      name: row.creature.name,
      level: row.plan.level,
      rank: row.plan.rank,
      damageScale: row.scale,
      inDungeon: dungeons.some((dungeon) =>
        dungeon.monsters.some((entry) => entry.creatureId === row.creature.id),
      ),
      before: pickCreature(row.creature),
      after: row.after,
    })),
    animals: animalPlans.map((row) => ({
      id: row.creature.id,
      name: row.creature.name,
      home: row.home,
      attackChance: row.creature.attackChance,
      before: {
        damageMin: row.creature.damageMin,
        damageMax: row.creature.damageMax,
      },
      after: row.after,
    })),
    grounds: groundPlans.map((row) => ({
      id: row.ground.id,
      name: row.ground.name,
      location: row.ground.location.name,
      level: row.level,
      before: {
        accidentDamageMin: row.ground.accidentDamageMin,
        accidentDamageMax: row.ground.accidentDamageMax,
      },
      after: row.after,
    })),
    dungeons: dungeonPlans.map((row) => ({
      id: row.dungeon.id,
      name: row.dungeon.name,
      location: row.dungeon.location.name,
      locationLevel: row.dungeon.location.requiredLevel,
      durationSeconds: row.dungeon.durationSeconds,
      packSize: row.dungeon.packSize,
      before: {
        requiredLevel: row.dungeon.requiredLevel,
        xpReward: row.dungeon.xpReward,
        durationSeconds: row.dungeon.durationSeconds,
        difficulty: row.dungeon.difficulty,
      },
      after: row.after,
    })),
    checks: { dungeons: dungeonChecks, hunting: huntingChecks, calibration },
    budgets,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(new URL("plan.json", OUT_DIR), JSON.stringify(plan, null, 2));
  printSummary(plan);

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
    return;
  }

  // --- Apply -------------------------------------------------------------
  const backup = {
    takenAt: new Date().toISOString(),
    items: itemPlans.map((row) => ({
      id: row.item.id,
      name: row.item.name,
      requiredLevel: row.item.requiredLevel,
      equipTo: row.item.equipTo,
      itemType: row.item.itemType,
      minPhysicalDamage: row.item.minPhysicalDamage,
      maxPhysicalDamage: row.item.maxPhysicalDamage,
      minMagicDamage: row.item.minMagicDamage,
      maxMagicDamage: row.item.maxMagicDamage,
      armor: row.item.armor,
      stats: row.item.stats,
    })),
    creatures: [...monsterPlans, ...animalPlans].map((row) =>
      pickCreature(row.creature),
    ),
    dungeons: dungeonPlans.map((row) => ({
      id: row.dungeon.id,
      requiredLevel: row.dungeon.requiredLevel,
      xpReward: row.dungeon.xpReward,
      durationSeconds: row.dungeon.durationSeconds,
      difficulty: row.dungeon.difficulty,
    })),
    grounds: groundPlans.map((row) => ({
      id: row.ground.id,
      accidentDamageMin: row.ground.accidentDamageMin,
      accidentDamageMax: row.ground.accidentDamageMax,
    })),
    growth: growthChanges.map((row) => ({
      statType: row.statType,
      ...row.before,
    })),
  };
  const backupUrl = new URL(`backup-${Date.now()}.json`, OUT_DIR);
  writeFileSync(backupUrl, JSON.stringify(backup, null, 2));
  console.log(`\nBackup written to ${backupUrl.pathname}`);

  for (const row of itemPlans) {
    const get = (type: StatType) =>
      row.after.find((stat) => stat.statType === type)?.value ?? 0;
    await prisma.$transaction([
      prisma.item.update({
        where: { id: row.item.id },
        data: {
          requiredLevel: row.plan.level,
          equipTo: row.equipTo,
          itemType: row.itemType,
          minPhysicalDamage: get(StatType.PHYSICAL_DAMAGE_MIN),
          maxPhysicalDamage: get(StatType.PHYSICAL_DAMAGE_MAX),
          minMagicDamage: get(StatType.MAGIC_DAMAGE_MIN),
          maxMagicDamage: get(StatType.MAGIC_DAMAGE_MAX),
          armor: get(StatType.ARMOR),
        },
      }),
      prisma.itemStat.deleteMany({ where: { itemId: row.item.id } }),
      prisma.itemStat.createMany({
        data: row.after.map((stat: BudgetedStat) => ({
          itemId: row.item.id,
          ...stat,
        })),
      }),
    ]);
  }
  console.log(`Updated ${itemPlans.length} items`);

  for (const row of monsterPlans) {
    await prisma.creature.update({
      where: { id: row.creature.id },
      data: row.after,
    });
  }
  for (const row of animalPlans) {
    await prisma.creature.update({
      where: { id: row.creature.id },
      data: row.after,
    });
  }
  console.log(
    `Updated ${monsterPlans.length} monsters and ${animalPlans.length} animals`,
  );

  for (const row of dungeonPlans) {
    await prisma.dungeon.update({
      where: { id: row.dungeon.id },
      data: row.after,
    });
  }
  for (const row of groundPlans) {
    await prisma.huntingGround.update({
      where: { id: row.ground.id },
      data: row.after,
    });
  }
  console.log(
    `Updated ${dungeonPlans.length} dungeons and ${groundPlans.length} hunting grounds`,
  );

  await prisma.$transaction([
    prisma.characterStatGrowth.deleteMany({
      where: { statType: { in: growthChanges.map((row) => row.statType) } },
    }),
    prisma.characterStatGrowth.createMany({
      data: growthChanges.map((row) => ({
        statType: row.statType,
        ...row.after,
      })),
    }),
  ]);
  console.log("Updated Magic Resist and Attack Speed growth");
}

function xpTotal(level: number) {
  let total = 0;
  for (let step = 1; step < level; step += 1)
    total += Math.max(1, Math.floor(xpStep(step)));
  return total;
}

function pickCreature(creature: {
  id: number;
  name: string;
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  elementalDamageMin: number;
  elementalDamageMax: number;
  health: number;
  armor: number;
  magicResist: number;
}) {
  return {
    id: creature.id,
    name: creature.name,
    damageMin: creature.damageMin,
    damageMax: creature.damageMax,
    magicDamageMin: creature.magicDamageMin,
    magicDamageMax: creature.magicDamageMax,
    elementalDamageMin: creature.elementalDamageMin,
    elementalDamageMax: creature.elementalDamageMax,
    health: creature.health,
    armor: creature.armor,
    magicResist: creature.magicResist,
  };
}

function printSummary(plan: {
  items: Array<{
    name: string;
    before: { level: number };
    after: { level: number; stats: Stat[] };
  }>;
  checks: {
    dungeons: Array<{
      name: string;
      location: string;
      level: number;
      reference: { survival: number; damageShare: number };
      plus10: { survival: number; damageShare: number };
      plus25: { survival: number; damageShare: number };
      bestGear: { survival: number; damageShare: number };
    }>;
    hunting: Array<{
      name: string;
      location: string;
      level: number;
      byDuration: Array<{ label: string; damageShare: number }>;
    }>;
  };
}) {
  console.log(
    "Dungeons: survival for the on-level reference, +10 and +25 levels, and this plan's best gear:",
  );
  for (const check of plan.checks.dungeons) {
    console.log(
      `  L${check.level} ${check.name} (${check.location}): ` +
        `${pct(check.reference.survival)} / ${pct(check.plus10.survival)} / ${pct(check.plus25.survival)} / gear ${pct(check.bestGear.survival)}; ` +
        `health lost on-level ${pct(check.reference.damageShare)}`,
    );
  }
  console.log("Hunting (health lost per expedition, on-level reference):");
  for (const check of plan.checks.hunting) {
    console.log(
      `  L${check.level} ${check.name} (${check.location}): ` +
        check.byDuration
          .map((row) => `${row.label} ${pct(row.damageShare)}`)
          .join(", "),
    );
  }
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
