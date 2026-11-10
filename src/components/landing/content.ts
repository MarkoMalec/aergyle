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

// The skill mentors, with the lines they greet you with on their skill pages
// (SkillPageHeader.tsx).
export const TOWNSFOLK = [
  {
    name: "Dain Flintward",
    trade: "Miner",
    sprite: "/assets/npcs/dain-flintward-miner-v3.png",
    quote:
      "Stone keeps its riches for those who read the seams. Strike in anger and the mountain charges you for it.",
  },
  {
    name: "Elowen Briarwell",
    trade: "Gatherer",
    sprite: "/assets/npcs/elowen-briarwell-gatherer-v1.png",
    quote:
      "The wild hides nothing from a careful hand. Notice what grows together, then take only what has another season to spare.",
  },
  {
    name: "Orrin Quill",
    trade: "Alchemist",
    sprite: "/assets/npcs/orrin-quill-alchemist-v2.png",
    quote:
      "If a mixture glows before you ask it to, set it down. Curiosity is useful; keeping your eyebrows is useful too.",
  },
  {
    name: "Sella Pikebriar",
    trade: "Hunter",
    sprite: "/assets/npcs/sella-pikebriar-hunter-v1.png",
    quote:
      "Leave a clean trail, take a clean shot, and thank the creature that carries you through winter.",
  },
  {
    name: "Maelin Copperspoon",
    trade: "Chef",
    sprite: "/assets/npcs/maelin-copperspoon-chef-v1.png",
    quote:
      "A full belly can turn a cold road into a story worth telling. Season with what the land has given.",
  },
  {
    name: "Marek Driftwater",
    trade: "Angler",
    sprite: "/assets/npcs/marek-driftwater-angler-v1.png",
    quote:
      "The river has no patience for noise. Mend your line, mind the current, and let the catch choose its moment.",
  },
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

/**
 * One Copper Ore run at its seeded pace: 11 s and 3 XP per ore. Four hours'
 * worth, the shortest run length planned for /admin/vocations, so the haul
 * never shows more than one run can earn.
 */
export const AWAY_SHIFT = {
  ore: Math.floor((4 * 3600) / 11),
  xp: Math.floor((4 * 3600) / 11) * 3,
} as const;
