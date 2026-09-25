import { ItemType, VocationalActionType } from "~/generated/prisma/enums";
import { toSkillNameFromActionType } from "~/utils/vocations";

export type CraftingRule = {
  label: string;
  catalogNoun: string;
  allowsLearnedRecipes: boolean;
};

/**
 * The item types a skill's resources may produce (`outputTypes`) and consume
 * as requirements (`inputTypes`). Admin-managed on /admin/vocations/rules and
 * loaded with getSkillItemRules; an empty list accepts every type.
 */
export type SkillItemRule = {
  outputTypes: ItemType[];
  inputTypes: ItemType[];
};

export type SkillItemRules = Partial<
  Record<VocationalActionType, SkillItemRule>
>;

export type CraftingCategory = {
  key: string;
  label: string;
};

const ITEM_TYPE_CATEGORY_LABELS: Partial<Record<ItemType, string>> = {
  [ItemType.SWORD]: "Swords",
  [ItemType.GREATSWORD]: "Greatswords",
  [ItemType.AXE]: "Axes",
  [ItemType.GREATAXE]: "Greataxes",
  [ItemType.FELLING_AXE]: "Felling Axes",
  [ItemType.PICKAXE]: "Pickaxes",
  [ItemType.FISHING_ROD]: "Fishing Rods",
  [ItemType.HOE]: "Hoes",
  [ItemType.BOW]: "Bows",
  [ItemType.CROSSBOW]: "Crossbows",
  [ItemType.STAFF]: "Staves",
  [ItemType.WAND]: "Wands",
  [ItemType.DAGGER]: "Daggers",
  [ItemType.MACE]: "Maces",
  [ItemType.SPEAR]: "Spears",
  [ItemType.FLAIL]: "Flails",
  [ItemType.SHIELD]: "Shields",
  [ItemType.HELMET]: "Headwear",
  [ItemType.CHESTPLATE]: "Chestwear",
  [ItemType.GREAVES]: "Legwear",
  [ItemType.BOOTS]: "Boots",
  [ItemType.GLOVES]: "Gloves",
  [ItemType.PAULDRONS]: "Shoulders",
  [ItemType.BRACERS]: "Bracers",
  [ItemType.BELT]: "Belts",
  [ItemType.INGOT]: "Ingots",
  [ItemType.MATERIAL]: "Components",
  [ItemType.FOOD]: "Dishes",
  [ItemType.OTHER]: "Other Items",
};

/**
 * The production engine remains shared with gathering vocations, while this
 * registry says which skills are crafting professions and how their catalog
 * reads. Which item types each skill accepts is admin data (SkillItemRule).
 * Recipes continue to use VocationalResource + VocationalRequirement.
 */
export const CRAFTING_RULES: Partial<
  Record<VocationalActionType, CraftingRule>
> = {
  [VocationalActionType.COOKING]: {
    label: "Cooking",
    catalogNoun: "dishes",
    allowsLearnedRecipes: true,
  },
  [VocationalActionType.ALCHEMY]: {
    label: "Alchemy",
    catalogNoun: "reagents",
    allowsLearnedRecipes: false,
  },
  [VocationalActionType.BLACKSMITHING]: {
    label: "Blacksmithing",
    catalogNoun: "metalwork",
    allowsLearnedRecipes: false,
  },
  [VocationalActionType.WEAPONSMITHING]: {
    label: "Weaponsmithing",
    catalogNoun: "weapons",
    allowsLearnedRecipes: false,
  },
  [VocationalActionType.CARPENTRY]: {
    label: "Carpentry",
    catalogNoun: "woodwork",
    allowsLearnedRecipes: false,
  },
  [VocationalActionType.TAILORING]: {
    label: "Tailoring",
    catalogNoun: "patterns",
    allowsLearnedRecipes: false,
  },
};

export function getCraftingRule(actionType: VocationalActionType) {
  return CRAFTING_RULES[actionType] ?? null;
}

export function getCraftingCategory(itemType: ItemType): CraftingCategory {
  return {
    key: itemType,
    label:
      ITEM_TYPE_CATEGORY_LABELS[itemType] ??
      itemType
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
  };
}

/** Stored order for a set of item types: the ItemType enum's own order. */
export function sortItemTypes(itemTypes: Iterable<ItemType>): ItemType[] {
  const wanted = new Set(itemTypes);
  return Object.values(ItemType).filter((itemType) => wanted.has(itemType));
}

/** Whether `allowed` (a SkillItemRule list) accepts `itemType`. */
export function acceptsItemType(
  allowed: readonly ItemType[] | undefined,
  itemType: ItemType | null | undefined,
) {
  if (!allowed || allowed.length === 0) return true;
  return itemType != null && allowed.includes(itemType);
}

export function getSkillLabel(actionType: VocationalActionType) {
  return (
    getCraftingRule(actionType)?.label ?? toSkillNameFromActionType(actionType)
  );
}

// No player page lists vocational resources for these: Gardening and Hunting
// run their own systems, and FORGE has no skill page at all.
const SKILLS_WITHOUT_RESOURCES: ReadonlySet<VocationalActionType> = new Set([
  VocationalActionType.GARDENING,
  VocationalActionType.HUNTING,
  VocationalActionType.FORGE,
]);

export function skillHoldsResources(actionType: VocationalActionType) {
  return !SKILLS_WITHOUT_RESOURCES.has(actionType);
}

/**
 * Why a resource cannot belong to `actionType`, or null when it can. The admin
 * API, the resource form and the /admin/vocations move picker all ask this, so
 * they agree on which skill may hold which resource.
 */
export function getResourceSkillConflict(params: {
  actionType: VocationalActionType;
  outputType: ItemType | null | undefined;
  requirementTypes: ReadonlyArray<ItemType | null | undefined>;
  hasRecipeGate: boolean;
  itemRules: SkillItemRules;
}): string | null {
  if (!skillHoldsResources(params.actionType)) {
    return `Players never see resources under ${params.actionType}`;
  }

  const rule = getCraftingRule(params.actionType);
  if (params.hasRecipeGate && !rule?.allowsLearnedRecipes) {
    const gatedSkills = Object.entries(CRAFTING_RULES)
      .filter(([, craft]) => craft?.allowsLearnedRecipes)
      .map(([skill]) => skill)
      .join(", ");
    return `Has a required recipe, which only ${gatedSkills} supports`;
  }

  if (rule && params.requirementTypes.length === 0) {
    return `${rule.label} recipes need at least one material`;
  }

  const skill = getSkillLabel(params.actionType);
  const itemRule = params.itemRules[params.actionType];
  if (!acceptsItemType(itemRule?.outputTypes, params.outputType)) {
    return `${skill} can't output ${params.outputType ?? "untyped"} items (allowed: ${itemRule!.outputTypes.join(", ")})`;
  }
  const refusedIndex = params.requirementTypes.findIndex(
    (itemType) => !acceptsItemType(itemRule?.inputTypes, itemType),
  );
  if (refusedIndex >= 0) {
    return `${skill} can't use ${params.requirementTypes[refusedIndex] ?? "untyped"} items as requirements (allowed: ${itemRule!.inputTypes.join(", ")})`;
  }

  // Bait is fixed by the fishing engine, which consumes one BAIT stack.
  if (params.actionType === VocationalActionType.FISHING) {
    if (params.requirementTypes.length > 1) {
      return "Fishing can have at most 1 bait requirement";
    }
    if (
      params.requirementTypes.length === 1 &&
      params.requirementTypes[0] !== ItemType.BAIT
    ) {
      return "Fishing requirements must be a BAIT item template";
    }
  }

  return null;
}
