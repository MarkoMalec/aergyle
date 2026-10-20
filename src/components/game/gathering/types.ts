import type { ItemRarity } from "~/generated/prisma/enums";

export type Reward = {
  resourceId: number;
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

export type Resource =
  | { unlocked: false; requiredGatheringLevel: number }
  | {
      unlocked: true;
      id: number;
      itemId: number;
      name: string;
      sprite: string;
      rarity: ItemRarity;
      requiredGatheringLevel: number;
      /** Chance per search with the character's current bonuses. */
      findChance: number;
      averageQuantity: number;
    };

export type Duration = {
  id: number;
  label: string;
  durationSeconds: number;
  rewardRolls: number;
  /** Duration multiplier times the character's yield bonus. */
  quantityScale: number;
  xpReward: number;
  requiredGatheringLevel: number;
  unlocked: boolean;
};

export type Modifiers = {
  luck: number;
  gatheringEfficiency: number;
  findBonusPercent: number;
  quantityBonusPercent: number;
  sources: {
    activeEffect: null | {
      itemId: number;
      name: string;
      sprite: string;
      endsAt: string;
    };
  };
};

export type Location = {
  id: number;
  name: string;
  gatheringEnabled: boolean;
  requiredLevel: number;
  requiredGatheringLevel: number;
  unlocked: boolean;
  resources: Resource[];
};

export type Expedition = {
  id: number;
  status: "ACTIVE" | "READY" | "CLAIMED";
  startedAt: string;
  endsAt: string;
  claimedAt: string | null;
  durationSeconds: number;
  location: { id: number; name: string };
  rewards: Reward[];
};

/** A claimed expedition kept in the expedition journal. */
export type JournalEntry = {
  id: number;
  startedAt: string;
  claimedAt: string;
  durationSeconds: number;
  xpReward: number;
  location: { id: number; name: string };
  rewards: Reward[];
};

export type GatheringData = {
  skillProgress: { level: number };
  modifiers: Modifiers;
  durations: Duration[];
  location: Location | null;
  expedition: Expedition | null;
  journal: JournalEntry[];
};
