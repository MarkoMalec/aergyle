import { ItemType, VocationalActionType } from "~/generated/prisma/enums";

export type CraftingRule = {
  label: string;
  catalogNoun: string;
  outputTypes: readonly ItemType[];
  inputTypes: readonly ItemType[];
  allowsLearnedRecipes: boolean;
  outputError: string;
  inputError: string;
};

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
 * registry defines the item contract for each crafting profession. Adding a
 * future craft means adding its enum value and one rule here; recipes continue
 * to use VocationalResource + VocationalRequirement.
 */
export const CRAFTING_RULES: Partial<
  Record<VocationalActionType, CraftingRule>
> = {
  [VocationalActionType.COOKING]: {
    label: "Cooking",
    catalogNoun: "dishes",
    outputTypes: [ItemType.FOOD],
    inputTypes: [ItemType.FISH, ItemType.MEAT, ItemType.VEGETABLE],
    allowsLearnedRecipes: true,
    outputError: "Cooking output must be a FOOD item template",
    inputError: "Cooking ingredients must be FISH, MEAT or VEGETABLE items",
  },
  [VocationalActionType.BLACKSMITHING]: {
    label: "Blacksmithing",
    catalogNoun: "metalwork",
    outputTypes: [
      ItemType.INGOT,
      ItemType.MATERIAL,
      ItemType.FELLING_AXE,
      ItemType.PICKAXE,
      ItemType.HOE,
      ItemType.SHIELD,
      ItemType.HELMET,
      ItemType.CHESTPLATE,
      ItemType.GREAVES,
      ItemType.BOOTS,
      ItemType.GLOVES,
      ItemType.PAULDRONS,
      ItemType.BRACERS,
      ItemType.BELT,
      ItemType.OTHER,
    ],
    inputTypes: [
      ItemType.ORE,
      ItemType.INGOT,
      ItemType.MATERIAL,
      ItemType.HIDE,
      ItemType.BLUEPRINT,
    ],
    allowsLearnedRecipes: false,
    outputError:
      "Blacksmithing output must be an ingot, metal component, tool, armor or shield item template",
    inputError:
      "Blacksmithing requirements must be ORE, INGOT, MATERIAL, HIDE or BLUEPRINT items",
  },
  [VocationalActionType.WEAPONSMITHING]: {
    label: "Weaponsmithing",
    catalogNoun: "weapons",
    outputTypes: [
      ItemType.SWORD,
      ItemType.GREATSWORD,
      ItemType.AXE,
      ItemType.GREATAXE,
      ItemType.DAGGER,
      ItemType.MACE,
      ItemType.SPEAR,
      ItemType.FLAIL,
    ],
    inputTypes: [
      ItemType.INGOT,
      ItemType.MATERIAL,
      ItemType.HIDE,
      ItemType.BLUEPRINT,
    ],
    allowsLearnedRecipes: false,
    outputError: "Weaponsmithing output must be a melee weapon item template",
    inputError:
      "Weaponsmithing requirements must be INGOT, MATERIAL, HIDE or BLUEPRINT items",
  },
  [VocationalActionType.CARPENTRY]: {
    label: "Carpentry",
    catalogNoun: "woodwork",
    outputTypes: [
      ItemType.MATERIAL,
      ItemType.BOW,
      ItemType.CROSSBOW,
      ItemType.FISHING_ROD,
      ItemType.OTHER,
    ],
    inputTypes: [
      ItemType.LOG,
      ItemType.MATERIAL,
      ItemType.INGOT,
      ItemType.HIDE,
      ItemType.BLUEPRINT,
    ],
    allowsLearnedRecipes: false,
    outputError:
      "Carpentry output must be a wooden component, bow, fishing rod or wooden item template",
    inputError:
      "Carpentry requirements must be LOG, MATERIAL, INGOT, HIDE or BLUEPRINT items",
  },
  [VocationalActionType.TAILORING]: {
    label: "Tailoring",
    catalogNoun: "patterns",
    outputTypes: [
      ItemType.CHESTPLATE,
      ItemType.GREAVES,
      ItemType.BOOTS,
      ItemType.GLOVES,
      ItemType.HELMET,
      ItemType.PAULDRONS,
      ItemType.BRACERS,
      ItemType.BELT,
      ItemType.HIDE,
    ],
    inputTypes: [ItemType.MATERIAL, ItemType.HIDE, ItemType.BLUEPRINT],
    allowsLearnedRecipes: false,
    outputError:
      "Tailoring output must be an apparel or prepared-hide item template",
    inputError:
      "Tailoring requirements must be MATERIAL, HIDE or BLUEPRINT items",
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

export function validateCraftingItemTypes(params: {
  actionType: VocationalActionType;
  outputType: ItemType | null | undefined;
  inputTypes: ReadonlyArray<ItemType | null | undefined>;
}): string | null {
  const rule = getCraftingRule(params.actionType);
  if (!rule) return null;
  if (!rule.outputTypes.includes(params.outputType!)) {
    return rule.outputError;
  }
  if (
    params.inputTypes.some(
      (itemType) => !rule.inputTypes.includes(itemType!),
    )
  ) {
    return rule.inputError;
  }
  return null;
}
