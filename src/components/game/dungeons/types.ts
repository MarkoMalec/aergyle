import type {
  CreatureAttackStyle,
  CreatureDamageType,
  DungeonDifficulty,
  ItemRarity,
} from "~/generated/prisma/enums";

export type Reward = {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

type CreatureRef = { creatureId: number; name: string; asset: string };

export type Report = {
  outcome: "CLEARED" | "DEFEATED";
  encounters: Array<CreatureRef & { damageTaken: number }>;
  defeatedBy: CreatureRef | null;
  damageTaken: number;
  evaded: number;
  blocked: number;
  criticalHits: number;
  xp?: number;
  health?: { before: number; after: number; max: number };
};

export type DungeonMonster = {
  id: number;
  name: string;
  asset: string;
  attackStyle: CreatureAttackStyle;
  damageType: CreatureDamageType | null;
};

export type Dungeon = {
  id: number;
  name: string;
  description: string | null;
  difficulty: DungeonDifficulty;
  requiredLevel: number;
  unlocked: boolean;
  durationSeconds: number;
  packSize: number;
  xpReward: number;
  /** Share of this dungeon's monster damage the character's armor stops. */
  armorReduction: number;
  recommendedHealth: number | null;
  monsters: DungeonMonster[];
};

type RunDungeon = {
  id: number;
  name: string;
  difficulty: DungeonDifficulty;
  location: { id: number; name: string };
};

export type Run = {
  id: number;
  status: "ACTIVE" | "READY" | "CLAIMED";
  startedAt: string;
  endsAt: string;
  claimedAt: string | null;
  durationSeconds: number;
  dungeon: RunDungeon;
  rewards: Reward[];
  report: Report | null;
};

/** A claimed run kept in the dungeon journal. */
export type JournalEntry = {
  id: number;
  startedAt: string;
  claimedAt: string;
  durationSeconds: number;
  dungeon: RunDungeon;
  rewards: Reward[];
  report: Report;
};

export type CombatStats = {
  physicalDamageMin: number;
  physicalDamageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  criticalChance: number;
  attackSpeed: number;
  armor: number;
  magicResist: number;
  evasionMelee: number;
  evasionRanged: number;
  evasionMagic: number;
  blockChance: number;
};

export type DungeonData = {
  level: number;
  vitals: {
    currentHealth: number;
    maxHealth: number;
    healthRegen: number;
    percent: number;
  };
  combat: CombatStats;
  minimumHealthToStartPercent: number;
  location: null | {
    id: number;
    name: string;
    unlocked: boolean;
    dungeons: Dungeon[];
  };
  run: Run | null;
  journal: JournalEntry[];
};
