import {
  ItemEquipTo,
  type ItemRarity,
  ItemType,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { humanize } from "~/components/admin/players/shared";
import { getSkillLabel } from "~/game/crafting";
import {
  CATEGORY_LABELS,
  GATHERING_SKILLS,
  itemCategory,
  type ItemCategory,
} from "~/game/itemGraph/taxonomy";
import { StatCategory, STAT_METADATA } from "~/types/stats";
import { resolveRarityColor } from "~/utils/rarity-colors";
import type { RarityConfigPreview } from "./itemFormModel";

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  group?: string;
  /** Extra search terms, such as the enum name the CSV uses. */
  keywords?: string;
  /** A swatch shown before the label, such as a rarity colour. */
  color?: string;
};

export function statLabel(statType: StatType) {
  return STAT_METADATA[statType]?.label ?? humanize(statType);
}

export function isPercentStat(statType: StatType) {
  return Boolean(STAT_METADATA[statType]?.isPercentage);
}

// The first matching group wins, so efficiencies are claimed before Utility.
const STAT_GROUPS: Array<{
  label: string;
  has: (statType: StatType) => boolean;
}> = [
  {
    label: "Offense",
    has: (s) => STAT_METADATA[s]?.category === StatCategory.OFFENSIVE,
  },
  {
    label: "Defense",
    has: (s) => STAT_METADATA[s]?.category === StatCategory.DEFENSIVE,
  },
  {
    label: "Resistances",
    has: (s) => STAT_METADATA[s]?.category === StatCategory.RESISTANCE,
  },
  {
    label: "Health & mana",
    has: (s) => STAT_METADATA[s]?.category === StatCategory.CHARACTER,
  },
  { label: "Vocation efficiency", has: (s) => s.endsWith("_EFFICIENCY") },
  { label: "Utility", has: () => true },
];
const STAT_GROUP_ORDER = [
  "Offense",
  "Defense",
  "Resistances",
  "Health & mana",
  "Utility",
  "Vocation efficiency",
];

/** Stat choices, grouped and ordered the way the game lists stats. */
export function statOptions(
  include: (statType: StatType) => boolean = () => true,
): ChoiceOption<StatType>[] {
  return (Object.values(StatType) as StatType[])
    .filter(include)
    .map((statType) => ({
      value: statType,
      label: statLabel(statType),
      group: STAT_GROUPS.find((group) => group.has(statType))!.label,
      keywords: statType,
    }))
    .sort(
      (a, b) =>
        STAT_GROUP_ORDER.indexOf(a.group) - STAT_GROUP_ORDER.indexOf(b.group) ||
        (STAT_METADATA[a.value]?.priority ?? 0) -
          (STAT_METADATA[b.value]?.priority ?? 0),
    );
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as ItemCategory[];

/** Item types grouped by the item graph's categories. */
export const ITEM_TYPE_OPTIONS: ChoiceOption<ItemType>[] = (
  Object.values(ItemType) as ItemType[]
)
  .map((itemType) => ({
    value: itemType,
    label: humanize(itemType),
    group: CATEGORY_LABELS[itemCategory(itemType)],
    keywords: itemType,
  }))
  .sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(itemCategory(a.value)) -
      CATEGORY_ORDER.indexOf(itemCategory(b.value)),
  );

const SLOT_NAMES: Partial<Record<ItemEquipTo, string>> = {
  offhand: "Off hand",
};

/** "fellingAxe" → "Felling axe". */
export function slotLabel(slot: string) {
  return (
    SLOT_NAMES[slot as ItemEquipTo] ??
    humanize(slot.replace(/([a-z])([A-Z])/g, "$1_$2"))
  );
}

const SLOT_GROUPS: Array<{ label: string; slots: ItemEquipTo[] }> = [
  {
    label: "Weapons & shields",
    slots: [ItemEquipTo.weapon, ItemEquipTo.offhand],
  },
  {
    label: "Armor",
    slots: [
      ItemEquipTo.head,
      ItemEquipTo.pauldrons,
      ItemEquipTo.chest,
      ItemEquipTo.bracers,
      ItemEquipTo.gloves,
      ItemEquipTo.belt,
      ItemEquipTo.greaves,
      ItemEquipTo.boots,
    ],
  },
  {
    label: "Accessories",
    slots: [
      ItemEquipTo.necklace,
      ItemEquipTo.amulet,
      ItemEquipTo.ring,
      ItemEquipTo.backpack,
    ],
  },
  {
    label: "Tools",
    slots: [
      ItemEquipTo.fellingAxe,
      ItemEquipTo.pickaxe,
      ItemEquipTo.fishingRod,
      ItemEquipTo.hoe,
    ],
  },
];

// A slot added to the schema later still shows, under Other.
const groupedSlots = new Set(SLOT_GROUPS.flatMap((group) => group.slots));

export const SLOT_OPTIONS: ChoiceOption<ItemEquipTo>[] = [
  ...SLOT_GROUPS.flatMap((group) =>
    group.slots.map((slot) => ({
      value: slot,
      label: slotLabel(slot),
      group: group.label,
      keywords: slot,
    })),
  ),
  ...(Object.values(ItemEquipTo) as ItemEquipTo[])
    .filter((slot) => !groupedSlots.has(slot))
    .map((slot) => ({
      value: slot,
      label: slotLabel(slot),
      group: "Other",
      keywords: slot,
    })),
];

export const SKILL_OPTIONS: ChoiceOption<VocationalActionType>[] = (
  Object.values(VocationalActionType) as VocationalActionType[]
)
  .map((actionType) => ({
    value: actionType,
    label: getSkillLabel(actionType),
    group: GATHERING_SKILLS.has(actionType) ? "Gathering" : "Crafting & other",
    keywords: actionType,
  }))
  .sort((a, b) => (a.group === b.group ? 0 : a.group === "Gathering" ? -1 : 1));

export function rarityLabel(
  rarity: ItemRarity,
  configs: readonly RarityConfigPreview[] | null,
) {
  const displayName = configs?.find(
    (config) => config.rarity === rarity,
  )?.displayName;
  return displayName ? displayName : humanize(rarity);
}

export function rarityColor(
  rarity: ItemRarity,
  configs: readonly RarityConfigPreview[] | null,
) {
  return resolveRarityColor(
    rarity,
    configs?.find((config) => config.rarity === rarity)?.color,
  );
}

export function rarityOptions(
  order: readonly ItemRarity[],
  configs: readonly RarityConfigPreview[] | null,
): ChoiceOption<ItemRarity>[] {
  return order.map((rarity) => ({
    value: rarity,
    label: rarityLabel(rarity, configs),
    keywords: rarity,
    color: rarityColor(rarity, configs),
  }));
}
