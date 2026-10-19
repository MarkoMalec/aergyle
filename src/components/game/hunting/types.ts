import type {
  CreatureAttackStyle,
  CreatureDamageType,
  ItemRarity,
} from "~/generated/prisma/enums";

export type Reward = {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

type Drop =
  | { unlocked: false; requiredHuntingLevel: number }
  | {
      unlocked: true;
      id: number;
      baseChance: number;
      minQuantity: number;
      maxQuantity: number;
      requiredHuntingLevel: number;
      item: { id: number; name: string; sprite: string; rarity: ItemRarity };
    };

export type Animal = {
  id: number;
  name: string;
  description: string | null;
  asset: string;
  encounterWeight: number;
  attackStyle: CreatureAttackStyle;
  attackChance: number;
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  damageType: CreatureDamageType | null;
  elementalDamageMin: number;
  elementalDamageMax: number;
  drops: Drop[];
};

export type Ground = {
  id: number;
  name: string;
  description: string | null;
  requiredHuntingLevel: number;
  unlocked: boolean;
  accidentChance: number;
  accidentDamage: { min: number; max: number };
  creatures: Animal[];
};

export type Duration = {
  id: number;
  label: string;
  durationSeconds: number;
  encounterRolls: number;
  dangerMultiplier: number;
  xpReward: number;
  requiredHuntingLevel: number;
  unlocked: boolean;
};

export type Report = {
  encounters: Array<{
    creatureId: number;
    name: string;
    asset: string;
    count: number;
    attacks: number;
    evaded: number;
    blocked: number;
    damageTaken: number;
  }>;
  accidents: { attempts: number; injuries: number; damageTaken: number };
  totalDamage: number;
  /** Damage before the safety cap and the health floor. */
  potentialDamage?: number;
  health?: { before: number; after: number; max: number };
};

type ExpeditionGround = {
  id: number;
  name: string;
  location: { id: number; name: string };
};

export type Expedition = {
  id: number;
  status: "ACTIVE" | "READY" | "CLAIMED";
  startedAt: string;
  endsAt: string;
  claimedAt: string | null;
  durationSeconds: number;
  ground: ExpeditionGround;
  rewards: Reward[];
  report: Report | null;
};

/** A claimed hunt kept in the hunt journal. */
export type JournalEntry = {
  id: number;
  startedAt: string;
  claimedAt: string;
  durationSeconds: number;
  xpReward: number;
  ground: ExpeditionGround;
  rewards: Reward[];
  report: Report;
};

export type Defenses = {
  armor: number;
  magicResist: number;
  evasionMelee: number;
  evasionRanged: number;
  evasionMagic: number;
  blockChance: number;
  movementSpeed: number;
  maxHealth: number;
};

export type Safety = {
  damageEnabled: boolean;
  globalDangerMultiplier: number;
  maxHealthLossPercent: number;
  minimumRemainingHealthPercent: number;
  minimumHealthToStartPercent: number;
};

export type HuntingData = {
  skillProgress: { level: number };
  modifiers: {
    luck: number;
    huntingEfficiency: number;
    defenses: Defenses;
    sources: {
      activeEffect: null | {
        itemId: number;
        name: string;
        sprite: string;
        endsAt: string;
      };
    };
  };
  vitals: {
    currentHealth: number;
    maxHealth: number;
    healthRegen: number;
    percent: number;
  };
  safety: Safety;
  durations: Duration[];
  location: null | {
    id: number;
    name: string;
    unlocked: boolean;
    grounds: Ground[];
  };
  expedition: Expedition | null;
  journal: JournalEntry[];
};
