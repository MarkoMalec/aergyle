import { StatType, ItemRarity } from "~/generated/prisma/enums";
import type { ItemType } from "~/generated/prisma/enums";

// Re-export Prisma enums for convenience
export { StatType, ItemRarity };

// Item with stats populated
export interface ItemWithStats {
  id: number;
  itemId: number; // Reference to Item template
  name: string;
  description?: string | null;
  price: number;
  sprite: string;
  itemType?: ItemType | null;
  equipTo: string | null;
  twoHanded?: boolean;
  rarity: ItemRarity;
  minPhysicalDamage: number | null;
  maxPhysicalDamage: number | null;
  minMagicDamage: number | null;
  maxMagicDamage: number | null;
  armor: number | null;
  requiredLevel: number | null;
  stackable?: boolean;
  maxStackSize?: number;
  isTradeable?: boolean;
  quantity?: number; // For stackable items
  stats: ItemStat[];
  healingAmount?: number | null;
  foodEffectSeconds?: number | null;
  foodEffectStats?: Array<{ statType: StatType; value: number }>;
}

// Individual stat on an item
export interface ItemStat {
  id?: number;
  itemId: number;
  statType: StatType;
  value: number;
}

// Computed character stats (after equipment bonuses)
export interface ComputedStats {
  // Offensive
  minPhysicalDamage: number;
  maxPhysicalDamage: number;
  minMagicDamage: number;
  maxMagicDamage: number;
  criticalChance: number;
  criticalDamage: number;
  attackSpeed: number;
  accuracy: number;

  // Defensive
  armor: number;
  magicResist: number;
  evasionMelee: number;
  evasionRanged: number;
  evasionMagic: number;
  blockChance: number;

  // Resistances
  fireResist: number;
  coldResist: number;
  lightningResist: number;
  poisonResist: number;

  // Character
  health: number;
  mana: number;
  healthRegen: number;
  manaRegen: number;

  // Special
  prayerPoints: number;
  movementSpeed: number;
  luck: number;
  goldFind: number;
  experienceGain: number;
  lifesteal: number;
  thorns: number;
  carryingCapacity: number;

  // Vocation/tool
  woodcuttingEfficiency: number;
  miningEfficiency: number;
  fishingEfficiency: number;
  gatheringEfficiency: number;
  huntingEfficiency: number;
}

// Stat display info for UI
export interface StatDisplay {
  statType: StatType;
  label: string;
  value: string;
  rawValue: number;
  color: string;
  icon: string;
  category: StatCategory;
  priority: number;
}

export enum StatCategory {
  OFFENSIVE = "offensive",
  DEFENSIVE = "defensive",
  RESISTANCE = "resistance",
  CHARACTER = "character",
  SPECIAL = "special",
}

// Stat metadata for display and grouping
export interface StatMetadata {
  label: string;
  shortLabel?: string;
  description: string;
  category: StatCategory;
  color: string;
  icon: string;
  priority: number;
  formatType: "number" | "percentage" | "range" | "decimal";
  isPercentage?: boolean;
}

// Map of stat types to their display metadata
export const STAT_METADATA: Record<StatType, StatMetadata> = {
  // Offensive
  PHYSICAL_DAMAGE_MIN: {
    label: "Physical Damage (Min)",
    shortLabel: "Phys Dmg",
    description: "Minimum physical damage dealt",
    category: StatCategory.OFFENSIVE,
    color: "#ef4444",
    icon: "⚔️",
    priority: 1,
    formatType: "number",
  },
  PHYSICAL_DAMAGE_MAX: {
    label: "Physical Damage (Max)",
    shortLabel: "Phys Dmg",
    description: "Maximum physical damage dealt",
    category: StatCategory.OFFENSIVE,
    color: "#ef4444",
    icon: "⚔️",
    priority: 2,
    formatType: "number",
  },
  MAGIC_DAMAGE_MIN: {
    label: "Magic Damage (Min)",
    shortLabel: "Magic Dmg",
    description: "Minimum magic damage dealt",
    category: StatCategory.OFFENSIVE,
    color: "#8b5cf6",
    icon: "✨",
    priority: 3,
    formatType: "number",
  },
  MAGIC_DAMAGE_MAX: {
    label: "Magic Damage (Max)",
    shortLabel: "Magic Dmg",
    description: "Maximum magic damage dealt",
    category: StatCategory.OFFENSIVE,
    color: "#8b5cf6",
    icon: "✨",
    priority: 4,
    formatType: "number",
  },
  CRITICAL_CHANCE: {
    label: "Critical Chance",
    description: "Chance to deal critical damage",
    category: StatCategory.OFFENSIVE,
    color: "#f59e0b",
    icon: "💥",
    priority: 5,
    formatType: "percentage",
    isPercentage: true,
  },
  CRITICAL_DAMAGE: {
    label: "Critical Damage",
    description: "Critical hit damage multiplier",
    category: StatCategory.OFFENSIVE,
    color: "#f59e0b",
    icon: "💢",
    priority: 6,
    formatType: "percentage",
    isPercentage: true,
  },
  ATTACK_SPEED: {
    label: "Attack Speed",
    description: "Attacks per second",
    category: StatCategory.OFFENSIVE,
    color: "#eab308",
    icon: "⚡",
    priority: 7,
    formatType: "decimal",
  },
  ACCURACY: {
    label: "Accuracy",
    description: "Chance to hit target",
    category: StatCategory.OFFENSIVE,
    color: "#22c55e",
    icon: "🎯",
    priority: 8,
    formatType: "number",
  },

  // Defensive
  ARMOR: {
    label: "Armor",
    description: "Reduces physical damage taken",
    category: StatCategory.DEFENSIVE,
    color: "#64748b",
    icon: "🛡️",
    priority: 10,
    formatType: "number",
  },
  MAGIC_RESIST: {
    label: "Magic Resist",
    description: "Reduces magic damage taken",
    category: StatCategory.DEFENSIVE,
    color: "#a78bfa",
    icon: "🔮",
    priority: 11,
    formatType: "number",
  },
  EVASION_MELEE: {
    label: "Evasion (Melee)",
    description: "Chance to evade melee attacks",
    category: StatCategory.DEFENSIVE,
    color: "#06b6d4",
    icon: "🌀",
    priority: 12,
    formatType: "percentage",
    isPercentage: true,
  },
  EVASION_RANGED: {
    label: "Evasion (Ranged)",
    description: "Chance to evade ranged attacks",
    category: StatCategory.DEFENSIVE,
    color: "#06b6d4",
    icon: "🏹",
    priority: 13,
    formatType: "percentage",
    isPercentage: true,
  },
  EVASION_MAGIC: {
    label: "Evasion (Magic)",
    description: "Chance to evade magic attacks",
    category: StatCategory.DEFENSIVE,
    color: "#06b6d4",
    icon: "🔯",
    priority: 14,
    formatType: "percentage",
    isPercentage: true,
  },
  BLOCK_CHANCE: {
    label: "Block Chance",
    description: "Chance to block attacks",
    category: StatCategory.DEFENSIVE,
    color: "#475569",
    icon: "🛡️",
    priority: 15,
    formatType: "percentage",
    isPercentage: true,
  },

  // Resistances
  FIRE_RESIST: {
    label: "Fire Resistance",
    description: "Reduces fire damage taken",
    category: StatCategory.RESISTANCE,
    color: "#dc2626",
    icon: "🔥",
    priority: 20,
    formatType: "percentage",
    isPercentage: true,
  },
  COLD_RESIST: {
    label: "Cold Resistance",
    description: "Reduces cold damage taken",
    category: StatCategory.RESISTANCE,
    color: "#3b82f6",
    icon: "❄️",
    priority: 21,
    formatType: "percentage",
    isPercentage: true,
  },
  LIGHTNING_RESIST: {
    label: "Lightning Resistance",
    description: "Reduces lightning damage taken",
    category: StatCategory.RESISTANCE,
    color: "#eab308",
    icon: "⚡",
    priority: 22,
    formatType: "percentage",
    isPercentage: true,
  },
  POISON_RESIST: {
    label: "Poison Resistance",
    description: "Reduces poison damage taken",
    category: StatCategory.RESISTANCE,
    color: "#22c55e",
    icon: "☠️",
    priority: 23,
    formatType: "percentage",
    isPercentage: true,
  },

  // Character
  HEALTH: {
    label: "Health",
    description: "Maximum health points",
    category: StatCategory.CHARACTER,
    color: "#dc2626",
    icon: "❤️",
    priority: 30,
    formatType: "number",
  },
  MANA: {
    label: "Mana",
    description: "Maximum mana points",
    category: StatCategory.CHARACTER,
    color: "#3b82f6",
    icon: "💙",
    priority: 31,
    formatType: "number",
  },
  HEALTH_REGEN: {
    label: "Health Regeneration",
    description: "Health restored per second",
    category: StatCategory.CHARACTER,
    color: "#ef4444",
    icon: "💚",
    priority: 32,
    formatType: "decimal",
  },
  MANA_REGEN: {
    label: "Mana Regeneration",
    description: "Mana restored per second",
    category: StatCategory.CHARACTER,
    color: "#60a5fa",
    icon: "💧",
    priority: 33,
    formatType: "decimal",
  },

  // Special
  PRAYER_POINTS: {
    label: "Prayer Points",
    description: "Points for prayer abilities",
    category: StatCategory.SPECIAL,
    color: "#fbbf24",
    icon: "🙏",
    priority: 40,
    formatType: "number",
  },
  MOVEMENT_SPEED: {
    label: "Movement Speed",
    description: "Character movement speed",
    category: StatCategory.SPECIAL,
    color: "#10b981",
    icon: "🏃",
    priority: 41,
    formatType: "percentage",
    isPercentage: true,
  },
  LUCK: {
    label: "Luck",
    description: "Increases item drop quality",
    category: StatCategory.SPECIAL,
    color: "#a855f7",
    icon: "🍀",
    priority: 42,
    formatType: "number",
  },
  GOLD_FIND: {
    label: "Gold Find",
    description: "Increased gold from enemies",
    category: StatCategory.SPECIAL,
    color: "#fbbf24",
    icon: "💰",
    priority: 43,
    formatType: "percentage",
    isPercentage: true,
  },
  EXPERIENCE_GAIN: {
    label: "Experience Gain",
    description: "Increased experience earned",
    category: StatCategory.SPECIAL,
    color: "#8b5cf6",
    icon: "⭐",
    priority: 44,
    formatType: "percentage",
    isPercentage: true,
  },
  LIFESTEAL: {
    label: "Lifesteal",
    description: "Heal for % of damage dealt",
    category: StatCategory.SPECIAL,
    color: "#dc2626",
    icon: "🩸",
    priority: 45,
    formatType: "percentage",
    isPercentage: true,
  },
  THORNS: {
    label: "Thorns",
    description: "Reflect damage to attackers",
    category: StatCategory.SPECIAL,
    color: "#84cc16",
    icon: "🌵",
    priority: 46,
    formatType: "number",
  },
  CARRYING_CAPACITY: {
    label: "Carrying Capacity",
    description: "Increases inventory capacity",
    category: StatCategory.SPECIAL,
    color: "#f97316",
    icon: "🎒",
    priority: 47,
    formatType: "number",
  },
  WOODCUTTING_EFFICIENCY: {
    label: "Woodcutting Efficiency",
    description: "Reduces time per woodcutting unit",
    category: StatCategory.SPECIAL,
    // Reuse an existing palette value already used elsewhere in this file.
    color: "#22c55e",
    icon: "🪓",
    priority: 48,
    formatType: "percentage",
    isPercentage: true,
  },
  MINING_EFFICIENCY: {
    label: "Mining Efficiency",
    description: "Reduces time per mining unit",
    category: StatCategory.SPECIAL,
    color: "#f97316",
    icon: "⛏️",
    priority: 49,
    formatType: "percentage",
    isPercentage: true,
  },
  FISHING_EFFICIENCY: {
    label: "Fishing Efficiency",
    description: "Reduces time per fishing unit",
    category: StatCategory.SPECIAL,
    color: "#3b82f6",
    icon: "🎣",
    priority: 50,
    formatType: "percentage",
    isPercentage: true,
  },
  GATHERING_EFFICIENCY: {
    label: "Gathering Efficiency",
    description: "Improves expedition find chance and gathered quantities",
    category: StatCategory.SPECIAL,
    color: "#2f8f83",
    icon: "🍃",
    priority: 51,
    formatType: "percentage",
    isPercentage: true,
  },
  HUNTING_EFFICIENCY: {
    label: "Hunting Efficiency",
    description: "Improves animal material find chance and quantities",
    category: StatCategory.SPECIAL,
    color: "#d97706",
    icon: "🏹",
    priority: 52,
    formatType: "percentage",
    isPercentage: true,
  },
};
