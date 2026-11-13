import type { Prisma } from "../../src/generated/prisma/client";
import type { ItemRarity, ItemType } from "../../src/generated/prisma/enums";

export interface EnchantingMaterialDefinition {
  slug: string;
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  requiredLevel: number;
  price: number;
}

/**
 * Stackable materials consumed by the enchanting bench. Their per-level costs
 * are configured separately on /admin/enchanting.
 */
export const ENCHANTING_MATERIALS = [
  {
    slug: "celestial-stone",
    name: "Celestial Stone",
    description:
      "A weathered blue-grey stone with faint starlit veins. Enchanters grind it into a steady catalyst for the first fifteen steps of an item's ascent.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    requiredLevel: 1,
    price: 12,
  },
] as const satisfies readonly EnchantingMaterialDefinition[];

export function enchantingMaterialSpritePath(
  item: EnchantingMaterialDefinition,
): string {
  return `/assets/items/resources/enchanting/${item.slug}-enchanting-v1.png`;
}

export function enchantingMaterialCreateData(
  item: EnchantingMaterialDefinition,
): Prisma.ItemCreateInput {
  return {
    name: item.name,
    description: item.description,
    price: item.price,
    sprite: enchantingMaterialSpritePath(item),
    itemType: item.itemType,
    equipTo: null,
    stackable: true,
    maxStackSize: 9_999,
    rarity: item.rarity,
    requiredLevel: item.requiredLevel,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    armor: 0,
  };
}
