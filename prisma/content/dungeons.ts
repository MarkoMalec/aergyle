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
] as const satisfies readonly MonsterDefinition[];

export const DUNGEONS = [
  {
    name: "Gloamvault",
    locationName: "Crownhold",
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
] as const satisfies readonly DungeonDefinition[];
