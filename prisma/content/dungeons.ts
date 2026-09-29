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
    asset: "/assets/creatures/monsters/low-level/goblin.png",
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
    name: "Orc",
    description:
      "A vicious raider armed with a hooked spear. Orcs shadow larger brutes, testing every opening before their master can bring down a heavier blow.",
    asset: "/assets/creatures/monsters/common/orc.png",
    attackStyle: "MELEE",
    damageMin: 9,
    damageMax: 14,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: 82,
    armor: 5,
    magicResist: 0,
    evasion: 5,
    blockChance: 0,
    critChance: 5,
    critDamage: 150,
    drops: [
      {
        itemName: "Cloth Scraps",
        baseChance: 0.4,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 40,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.3,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 40,
      },
    ],
  },
  {
    name: "Warg",
    description:
      "A tether-scarred raiding hound bred to run down anything its handlers point at. A warg is quick alone; in a pack it is relentless.",
    asset: "/assets/creatures/monsters/common/warg.png",
    attackStyle: "MELEE",
    damageMin: 10,
    damageMax: 16,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: 100,
    armor: 4,
    magicResist: 0,
    evasion: 10,
    blockChance: 0,
    critChance: 8,
    critDamage: 150,
    drops: [
      {
        itemName: "Thick Fur",
        baseChance: 0.4,
        minQuantity: 1,
        maxQuantity: 1,
        requiredLevel: 40,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.3,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 40,
      },
    ],
  },
  {
    name: "Ogre",
    description:
      "A brutal raider with a butcher's cleaver and enough discipline to make its strength dangerous. Ogres hold a territory until nothing nearby can stand up to them.",
    asset: "/assets/creatures/monsters/rare/ogre.png",
    attackStyle: "MELEE",
    damageMin: 17,
    damageMax: 27,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: 225,
    armor: 14,
    magicResist: 2,
    evasion: 2,
    blockChance: 1,
    critChance: 5,
    critDamage: 150,
    drops: [
      {
        itemName: "Ogre Cleaver",
        baseChance: 0.025,
        minQuantity: 1,
        maxQuantity: 1,
        requiredLevel: 40,
      },
      {
        itemName: "Thick Fur",
        baseChance: 0.3,
        minQuantity: 1,
        maxQuantity: 1,
        requiredLevel: 40,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.35,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 40,
      },
    ],
  },
  {
    name: "Trollhound",
    description:
      "A cave-bred kennel beast that follows a troll's scent through the dark. Its bite is ugly, but its true danger is returning with the rest of the pack.",
    asset: "/assets/creatures/monsters/common/trollhound.png",
    attackStyle: "MELEE",
    damageMin: 13,
    damageMax: 19,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: 130,
    armor: 8,
    magicResist: 2,
    evasion: 4,
    blockChance: 0,
    critChance: 6,
    critDamage: 155,
    drops: [
      {
        itemName: "Thick Fur",
        baseChance: 0.5,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 50,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.4,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 50,
      },
    ],
  },
  {
    name: "Cave Troll",
    description:
      "A slow-witted cave brute with a vacant stare and a club it has only just remembered to hold. It is clumsy, stubborn, and alarmingly strong when confused.",
    asset: "/assets/creatures/monsters/rare/cave-troll.png",
    attackStyle: "MELEE",
    damageMin: 24,
    damageMax: 36,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: 310,
    armor: 20,
    magicResist: 4,
    evasion: 1,
    blockChance: 0,
    critChance: 4,
    critDamage: 150,
    drops: [
      {
        itemName: "Troll Blood",
        baseChance: 0.06,
        minQuantity: 1,
        maxQuantity: 1,
        requiredLevel: 55,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.3,
        minQuantity: 1,
        maxQuantity: 2,
        requiredLevel: 50,
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
    name: "Blackjaw Stockade",
    locationName: "Goblins Camp",
    locationAliases: [],
    description:
      "A crude timber stockade hidden in the ashwood, where an ogre drives orc raiders and chained wargs from its cleaver-sharpening yard.",
    difficulty: "NORMAL",
    requiredLevel: 40,
    durationSeconds: 1_200,
    packSize: 2,
    xpReward: 175,
    sortOrder: 10,
    monsters: [
      { name: "Ogre", minCount: 1, maxCount: 1 },
      { name: "Orc", minCount: 3, maxCount: 5 },
      { name: "Warg", minCount: 2, maxCount: 3 },
    ],
  },
  {
    name: "Drowned Mouth Grotto",
    locationName: "Frostcrown Peaks",
    locationAliases: [],
    description:
      "A wet limestone hollow below the high passes, where cave trolls bellow at echoes and guard the bones they cannot count.",
    difficulty: "NORMAL",
    requiredLevel: 50,
    durationSeconds: 1_500,
    packSize: 2,
    xpReward: 250,
    sortOrder: 50,
    monsters: [
      { name: "Cave Troll", minCount: 1, maxCount: 1 },
      { name: "Trollhound", minCount: 3, maxCount: 5 },
    ],
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
    packSize: 2,
    xpReward: 380,
    sortOrder: 60,
    monsters: [
      { name: "Stoneback Troll", minCount: 1, maxCount: 1 },
      { name: "Trollhound", minCount: 4, maxCount: 6 },
    ],
  },
] as const satisfies readonly DungeonDefinition[];
