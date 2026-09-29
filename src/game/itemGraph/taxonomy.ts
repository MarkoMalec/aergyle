import { ItemType, VocationalActionType } from "~/generated/prisma/enums";

/** How an item can enter the game. */
export type SourceKind =
  | "CRAFTED"
  | "GATHERED"
  | "GROWN"
  | "DROPPED"
  | "SOLD"
  | "QUEST";

export const SOURCE_KINDS: ReadonlyArray<{ kind: SourceKind; label: string }> = [
  { kind: "CRAFTED", label: "Crafted" },
  { kind: "GATHERED", label: "Gathered" },
  { kind: "GROWN", label: "Grown" },
  { kind: "DROPPED", label: "Dropped" },
  { kind: "SOLD", label: "Sold by NPC" },
  { kind: "QUEST", label: "Quest reward" },
];

/**
 * Where an item sits in the production chains:
 * RAW is obtained without crafting, INTERMEDIATE is crafted and crafted into
 * something else, FINISHED is used by no recipe.
 */
export type ItemRole = "RAW" | "INTERMEDIATE" | "FINISHED";

export const ROLE_LABELS: Record<ItemRole, string> = {
  RAW: "Raw",
  INTERMEDIATE: "Intermediate",
  FINISHED: "Finished",
};

/** Resource skills whose resources are harvested rather than crafted. */
export const GATHERING_SKILLS: ReadonlySet<VocationalActionType> = new Set([
  VocationalActionType.WOODCUTTING,
  VocationalActionType.MINING,
  VocationalActionType.FISHING,
  VocationalActionType.GATHERING,
]);

export type ItemCategory =
  | "EQUIPMENT"
  | "TOOL"
  | "RESOURCE"
  | "COMPONENT"
  | "CONSUMABLE"
  | "BLUEPRINT"
  | "BAIT_SEED"
  | "OTHER";

const CATEGORY_TYPES: Record<ItemCategory, ItemType[]> = {
  EQUIPMENT: [
    ItemType.SWORD,
    ItemType.GREATSWORD,
    ItemType.AXE,
    ItemType.GREATAXE,
    ItemType.BOW,
    ItemType.CROSSBOW,
    ItemType.STAFF,
    ItemType.WAND,
    ItemType.DAGGER,
    ItemType.MACE,
    ItemType.SPEAR,
    ItemType.FLAIL,
    ItemType.SHIELD,
    ItemType.HELMET,
    ItemType.CHESTPLATE,
    ItemType.GREAVES,
    ItemType.BOOTS,
    ItemType.GLOVES,
    ItemType.PAULDRONS,
    ItemType.BRACERS,
    ItemType.BELT,
    ItemType.RING,
    ItemType.AMULET,
    ItemType.NECKLACE,
    ItemType.BACKPACK,
  ],
  TOOL: [ItemType.FELLING_AXE, ItemType.PICKAXE, ItemType.FISHING_ROD, ItemType.HOE],
  RESOURCE: [
    ItemType.ORE,
    ItemType.LOG,
    ItemType.HERB,
    ItemType.FISH,
    ItemType.HIDE,
    ItemType.STONE,
    ItemType.GEM,
    ItemType.MEAT,
    ItemType.VEGETABLE,
  ],
  COMPONENT: [ItemType.INGOT, ItemType.MATERIAL],
  CONSUMABLE: [ItemType.POTION, ItemType.FOOD, ItemType.ELIXIR, ItemType.SCROLL],
  BLUEPRINT: [ItemType.BLUEPRINT, ItemType.RECIPE],
  BAIT_SEED: [ItemType.BAIT, ItemType.SEED],
  OTHER: [
    ItemType.QUEST_ITEM,
    ItemType.KEY,
    ItemType.CURRENCY,
    ItemType.PET,
    ItemType.MOUNT,
    ItemType.OTHER,
  ],
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  EQUIPMENT: "Equipment",
  TOOL: "Tools",
  RESOURCE: "Resources",
  COMPONENT: "Components",
  CONSUMABLE: "Consumables",
  BLUEPRINT: "Blueprints & recipes",
  BAIT_SEED: "Bait & seeds",
  OTHER: "Other",
};

const CATEGORY_BY_TYPE = new Map<ItemType, ItemCategory>(
  (Object.entries(CATEGORY_TYPES) as Array<[ItemCategory, ItemType[]]>).flatMap(
    ([category, types]) => types.map((type) => [type, category] as const),
  ),
);

export function itemCategory(itemType: ItemType | null): ItemCategory {
  return (itemType && CATEGORY_BY_TYPE.get(itemType)) ?? "OTHER";
}

/**
 * Item types that are only worth something as crafting input. Such an item
 * that nothing consumes is a dead end; anything else (gear, food, bait,
 * recipes...) has a use of its own.
 */
const MATERIAL_TYPES: ReadonlySet<ItemType | null> = new Set<ItemType | null>([
  ...CATEGORY_TYPES.RESOURCE,
  ...CATEGORY_TYPES.COMPONENT,
  ItemType.BLUEPRINT,
  ItemType.OTHER,
  null,
]);

export function isMaterialType(itemType: ItemType | null) {
  return MATERIAL_TYPES.has(itemType);
}

/**
 * One colour per skill, readable on the dark admin surface. Links are drawn
 * in the colour of the skill that performs the step.
 */
export const SKILL_COLORS: Record<VocationalActionType, string> = {
  MINING: "#a8b3c2",
  WOODCUTTING: "#a3e635",
  GATHERING: "#2dd4bf",
  GARDENING: "#4ade80",
  FISHING: "#38bdf8",
  HUNTING: "#d9a066",
  ALCHEMY: "#c084fc",
  BLACKSMITHING: "#fb923c",
  WEAPONSMITHING: "#f87171",
  CARPENTRY: "#facc15",
  COOKING: "#fb7185",
  TAILORING: "#818cf8",
  FORGE: "#e879f9",
};
