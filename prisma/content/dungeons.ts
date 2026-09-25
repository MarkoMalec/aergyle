import type {
  CreatureAttackStyle,
  CreatureDamageType,
  DungeonDifficulty,
} from "../../src/generated/prisma/enums";
import type { AtlasLocationName } from "../../src/game/world/atlasLocations";

export interface MonsterDropDefinition {
  itemName: string;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
  /** Character level. */
  requiredLevel: number;
}

export interface MonsterDefinition {
  name: string;
  description: string;
  asset: string;
  attackStyle: CreatureAttackStyle;
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  damageType: CreatureDamageType | null;
  elementalDamageMin: number;
  elementalDamageMax: number;
  health: number;
  armor: number;
  magicResist: number;
  evasion: number;
  blockChance: number;
  critChance: number;
  critDamage: number;
  drops: readonly MonsterDropDefinition[];
}

export interface DungeonDefinition {
  name: string;
  locationName: AtlasLocationName;
  /** Renamed live-location labels accepted by the additive seeder. */
  locationAliases?: readonly string[];
  description: string;
  difficulty: DungeonDifficulty;
  requiredLevel: number;
  durationSeconds: number;
  /** Monsters fighting the character at once; 1 = one at a time. */
  packSize: number;
  xpReward: number;
  sortOrder: number;
  monsters: readonly { name: string; minCount: number; maxCount: number }[];
}

export const DUNGEON_MONSTERS = [
  {
    name: "Goblin",
    description:
      "A wiry scavenger with quick hands and a notched blade. Goblins rarely fight fair, and they never fight alone.",
    asset: "/assets/creatures/monsters/goblin.png",
    attackStyle: "MELEE",
    damageMin: 1,
    damageMax: 3,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: 18,
    armor: 2,
    magicResist: 0,
    evasion: 5,
    blockChance: 0,
    critChance: 5,
    critDamage: 150,
    drops: [
      {
        itemName: "Cloth Scraps",
        baseChance: 0.45,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 1,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.3,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 1,
      },
      {
        itemName: "Dusk Oil",
        baseChance: 0.12,
        minQuantity: 1,
        maxQuantity: 1,
        requiredLevel: 1,
      },
      {
        itemName: "Wooden Dagger",
        baseChance: 0.03,
        minQuantity: 1,
        maxQuantity: 1,
        requiredLevel: 1,
      },
    ],
  },
  {
    name: "Stoneback Troll",
    description:
      "A mountain troll plated in old stone and frozen mud. Its brute strength makes every harvested blood sample a hard-won prize.",
    asset: "/assets/creatures/monsters/rare/stoneback-troll.png",
    attackStyle: "MELEE",
    damageMin: 38,
    damageMax: 58,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: 520,
    armor: 46,
    magicResist: 12,
    evasion: 4,
    blockChance: 8,
    critChance: 10,
    critDamage: 165,
    drops: [
      {
        itemName: "Troll Blood",
        baseChance: 0.12,
        minQuantity: 1,
        maxQuantity: 1,
        requiredLevel: 65,
      },
      {
        itemName: "Thick Fur",
        baseChance: 0.42,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 60,
      },
    ],
  },
] as const satisfies readonly MonsterDefinition[];

export const DUNGEONS = [
  {
    name: "Gloamvault",
    locationName: "Crownhold",
    locationAliases: ["Valedor"],
    description:
      "Flooded vaults beneath the Quay ward, where goblin scavengers hoard lamp oil and stolen cloth in the dark.",
    difficulty: "EASY",
    requiredLevel: 1,
    durationSeconds: 900,
    packSize: 1,
    xpReward: 12,
    sortOrder: 10,
    monsters: [{ name: "Goblin", minCount: 2, maxCount: 4 }],
  },
  {
    name: "Trollbreaker Cavern",
    locationName: "Frostcrown Peaks",
    locationAliases: [],
    description:
      "A wind-carved fissure beneath the high passes where stoneback trolls wallow in meltwater and old bones.",
    difficulty: "HARD",
    requiredLevel: 65,
    durationSeconds: 1_800,
    packSize: 1,
    xpReward: 260,
    sortOrder: 60,
    monsters: [{ name: "Stoneback Troll", minCount: 1, maxCount: 2 }],
  },
] as const satisfies readonly DungeonDefinition[];
