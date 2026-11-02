// Everything the homepage names comes from live game content: vocation art in
// public/assets/skills, recipes in prisma/content, NPC and creature sprites.
// Keep these in step when the game renames or retires something.

export const GATHERING_CALLINGS = [
  {
    skill: "woodcutting",
    name: "Woodcutting",
    line: "Oak at first light. Ironbark and emberwood once your arms can take it.",
  },
  {
    skill: "mining",
    name: "Mining",
    line: "Copper and tin first. Cobalt, sunstone and umbracite further down.",
  },
  {
    skill: "fishing",
    name: "Fishing",
    line: "Pick the bait, read the water, land the trout before the mist lifts.",
  },
  {
    skill: "gathering",
    name: "Gathering",
    line: "Hedgerow expeditions that come home heavy with berries, herbs and chestnuts.",
  },
  {
    skill: "gardening",
    name: "Gardening",
    line: "Seeds in the ground, crops in the pack, a plot that is yours alone.",
  },
  {
    skill: "hunting",
    name: "Hunting",
    line: "Track deer, boar and wolves across ten hunting grounds.",
  },
] as const;

type ChainStep = { name: string; sprite: string };
type ChainLink = { verb: string; skill: string; skillName: string };

export type CraftChain = {
  steps: readonly ChainStep[];
  links: readonly ChainLink[];
  /** Rarity of the finished item, for its name colour. */
  finish: "COMMON" | "UNCOMMON";
};

const ITEMS = "/assets/items";

export const CRAFT_CHAINS: readonly CraftChain[] = [
  {
    steps: [
      { name: "Copper Ore", sprite: `${ITEMS}/resources/ores/copper-ore-atlas-v1.png` },
      { name: "Copper Ingot", sprite: `${ITEMS}/resources/ingots/copper-ingot-atlas-v1.png` },
      { name: "Copper Longsword", sprite: `${ITEMS}/weapons/swords/copper-longsword-v1.png` },
    ],
    links: [
      { verb: "Smelt", skill: "blacksmithing", skillName: "Blacksmithing" },
      { verb: "Forge", skill: "weaponsmithing", skillName: "Weaponsmithing" },
    ],
    finish: "COMMON",
  },
  {
    steps: [
      { name: "Ash Log", sprite: `${ITEMS}/resources/logs/ash-log-atlas-v1.png` },
      { name: "Ash Plank", sprite: `${ITEMS}/resources/planks/ash-plank-carpentry-v1.png` },
      { name: "Ash Longbow", sprite: `${ITEMS}/weapons/bows/ash-longbow-v1.png` },
    ],
    links: [
      { verb: "Saw", skill: "carpentry", skillName: "Carpentry" },
      { verb: "Shape", skill: "carpentry", skillName: "Carpentry" },
    ],
    finish: "UNCOMMON",
  },
  {
    steps: [
      { name: "Mint", sprite: `${ITEMS}/resources/herbs/mint-gathering-v1.png` },
      { name: "Verdant Dye", sprite: `${ITEMS}/resources/armor-components/verdant-dye-armor-sets-v1.png` },
      { name: "Mossweave Bolt", sprite: `${ITEMS}/resources/armor-components/mossweave-bolt-armor-sets-v1.png` },
      { name: "Mossweave Vest", sprite: `${ITEMS}/armor/mossweave-vest-armor-sets-v1.png` },
    ],
    links: [
      { verb: "Brew", skill: "alchemy", skillName: "Alchemy" },
      { verb: "Weave", skill: "tailoring", skillName: "Tailoring" },
      { verb: "Tailor", skill: "tailoring", skillName: "Tailoring" },
    ],
    finish: "UNCOMMON",
  },
  {
    steps: [
      { name: "Perch", sprite: `${ITEMS}/resources/fish/perch-fish.png` },
      { name: "Pan-fried Perch", sprite: `${ITEMS}/consumables/food/pan-fried-perch-cooking-v2.png` },
    ],
    links: [{ verb: "Cook", skill: "cooking", skillName: "Cooking" }],
    finish: "COMMON",
  },
];

export const TOWNSFOLK = [
  { name: "Dain Flintward", trade: "Miner", sprite: "/assets/npcs/dain-flintward-miner-v3.png" },
  { name: "Elowen Briarwell", trade: "Gatherer", sprite: "/assets/npcs/elowen-briarwell-gatherer-v1.png" },
  { name: "Orrin Quill", trade: "Alchemist", sprite: "/assets/npcs/orrin-quill-alchemist-v2.png" },
  { name: "Varka Ten-Reeds", trade: "Hunter", sprite: "/assets/npcs/varka-ten-reeds-hunter-v1.png" },
  { name: "Vesa Emberladle", trade: "Cook", sprite: "/assets/npcs/vesa-emberladle-cook-v1.png" },
  { name: "Rusk Fenlock", trade: "Angler", sprite: "/assets/npcs/rusk-fenlock-angler-v1.png" },
] as const;

const MONSTERS = "/assets/creatures/monsters";

export const BESTIARY = [
  { name: "Cavefang Spider", sprite: `${MONSTERS}/common/cavefang-spider.png` },
  { name: "Emberhorn Minotaur", sprite: `${MONSTERS}/rare/emberhorn-minotaur.png` },
  { name: "Hollow Wyrm", sprite: `${MONSTERS}/rare/hollow-wyrm.png` },
  { name: "Miremaw Hydra", sprite: `${MONSTERS}/rare/miremaw-hydra.png` },
  { name: "Stoneback Troll", sprite: `${MONSTERS}/rare/stoneback-troll.png` },
  { name: "Tomb Sentinel", sprite: `${MONSTERS}/rare/tomb-sentinel.png` },
] as const;

export const DUNGEON_NAMES = [
  "Thornroad Hollow",
  "Gloamvault",
  "Sunken Masonworks",
  "Blackjaw Stockade",
  "Bogmouth Kilns",
  "Caldrath Undervaults",
  "Drowned Mouth Grotto",
  "Trollbreaker Cavern",
  "Hollowmaw Sinkhole",
  "Emberhorn Labyrinth",
  "Wreckers' Grotto",
  "Dreadspire Ossuary",
] as const;

/** One 8-hour Copper Ore shift at its seeded pace: 11 s and 3 XP per ore. */
export const AWAY_SHIFT = {
  hours: 8,
  ore: Math.floor((8 * 3600) / 11),
  xp: Math.floor((8 * 3600) / 11) * 3,
} as const;
