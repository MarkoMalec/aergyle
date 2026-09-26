import type {
  ItemEquipTo,
  ItemRarity,
  ItemType,
  QuestRepeat,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import type { DungeonMonsterPoolEntry } from "~/server/dungeons/resolver";
import type { StatGrowthRule } from "~/utils/stats";

/**
 * Everything the balance tools read, loaded once per admin page by
 * src/server/balance/content.ts and passed to the browser as plain JSON.
 */

export type Skill = VocationalActionType;
/** A level track: the character level or one skill. */
export type Track = "CHARACTER" | Skill;
/** A timed activity the character can spend hours on. */
export type ActivityGroup = Skill | "DUNGEONS";
/** Anything that grants XP; the unit of the what-if XP scale. */
export type XpGroup = ActivityGroup | "QUESTS";

export type BalanceResource = {
  id: number;
  skill: Skill;
  name: string;
  itemId: number;
  requiredSkillLevel: number;
  /** Lowest character level among locations offering it; null when none do. */
  requiredCharacterLevel: number | null;
  baseSeconds: number;
  xpPerUnit: number;
  yieldPerUnit: number;
  recipeLocked: boolean;
  inputs: Array<{ itemId: number; quantity: number }>;
};

export type BalanceExpeditionTier = {
  id: number;
  skill: "GATHERING" | "HUNTING";
  label: string;
  seconds: number;
  xp: number;
  requiredSkillLevel: number;
};

/** A hunting ground or gathering location: where expeditions can depart. */
export type BalanceExpeditionArea = {
  skill: "GATHERING" | "HUNTING";
  name: string;
  requiredSkillLevel: number;
  requiredCharacterLevel: number;
};

export type BalanceSeed = {
  itemId: number;
  name: string;
  xp: number;
  growSeconds: number;
  harvestSeconds: number;
};

export type BalanceDungeon = {
  id: number;
  name: string;
  locationName: string;
  /** The higher of the dungeon's and its location's requirement. */
  requiredLevel: number;
  seconds: number;
  xp: number;
  packSize: number;
  /** Combat profiles only; drops are left out (survival ignores loot). */
  monsters: DungeonMonsterPoolEntry[];
};

export type BalanceQuest = {
  id: number;
  name: string;
  npcName: string;
  requiredLevel: number;
  xp: number;
  repeat: QuestRepeat;
};

export type BalanceLocation = {
  id: number;
  name: string;
  requiredLevel: number;
  gatheringEnabled: boolean;
  gatheringRequiredLevel: number;
};

export type BalanceItemStats = {
  flip: boolean;
  stats: Array<{ statType: StatType; value: number; maxValue: number | null }>;
  progressions: Array<{
    statType: StatType;
    baseValue: number;
    unlocksAtRarity: ItemRarity;
  }>;
  overrides: Array<{
    statType: StatType;
    rarity: ItemRarity;
    kind: "MULTIPLIER" | "ABSOLUTE";
    value: number;
  }>;
};

export type BalanceItem = {
  id: number;
  name: string;
  requiredLevel: number;
  itemType: ItemType | null;
  equipTo: ItemEquipTo | null;
  twoHanded: boolean;
  /** Stat templates, for equippable items only. */
  balance: BalanceItemStats | null;
};

export type BalanceRarity = {
  rarity: ItemRarity;
  label: string;
  multiplier: number;
};

export type BalanceContent = {
  resources: BalanceResource[];
  expeditionTiers: BalanceExpeditionTier[];
  expeditionAreas: BalanceExpeditionArea[];
  seeds: BalanceSeed[];
  gardenTiles: number;
  dungeons: BalanceDungeon[];
  quests: BalanceQuest[];
  locations: BalanceLocation[];
  items: BalanceItem[];
  rarities: BalanceRarity[];
  statGrowth: Record<StatType, StatGrowthRule>;
  /** Longest single vocation start. */
  vocationMaxSeconds: number;
};

export const SKILL_LABELS: Record<Skill, string> = {
  WOODCUTTING: "Woodcutting",
  MINING: "Mining",
  FISHING: "Fishing",
  GARDENING: "Gardening",
  GATHERING: "Gathering",
  HUNTING: "Hunting",
  ALCHEMY: "Alchemy",
  BLACKSMITHING: "Blacksmithing",
  WEAPONSMITHING: "Weaponsmithing",
  CARPENTRY: "Carpentry",
  COOKING: "Cooking",
  TAILORING: "Tailoring",
  FORGE: "Forge",
};

export const SKILLS = Object.keys(SKILL_LABELS) as Skill[];

export function trackLabel(track: Track) {
  return track === "CHARACTER" ? "Character" : SKILL_LABELS[track];
}

export function groupLabel(group: XpGroup | "GARDEN") {
  if (group === "DUNGEONS") return "Dungeons";
  if (group === "QUESTS") return "Quests";
  if (group === "GARDEN") return "Garden";
  return SKILL_LABELS[group];
}

/** Skills whose resources are started from the skill page (timed units). */
export function isVocationSkill(skill: Skill) {
  return skill !== "GATHERING" && skill !== "HUNTING" && skill !== "GARDENING";
}
