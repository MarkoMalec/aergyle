import type {
  CreatureKind,
  ItemRarity,
  ItemType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import type { SkillItemRules } from "~/game/crafting";

/**
 * Everything the item graph reads, loaded once per admin page by
 * src/server/itemGraph/content.ts and handed to the browser as plain JSON.
 * Every traversal, layout and check runs on this in memory.
 */

export type GraphItem = {
  id: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  itemType: ItemType | null;
  /** Has an equipment slot: worn or wielded, so it has a use of its own. */
  equippable: boolean;
  requiredLevel: number;
  price: number;
  /** Gardening: what planting this seed grows, when configured. */
  seed: {
    yieldItemId: number;
    min: number;
    max: number;
    growSeconds: number;
    /** Grow and harvest times are set, so the garden accepts it. */
    plantable: boolean;
  } | null;
};

/** A VocationalResource: how its item is made, and what one unit consumes. */
export type GraphRecipe = {
  id: number;
  itemId: number;
  skill: VocationalActionType;
  name: string;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  rarity: ItemRarity;
  /** RECIPE item a character must learn first; not consumed. */
  unlockItemId: number | null;
  inputs: Array<{ itemId: number; quantity: number }>;
  /** Locations where players can work it (enabled rows; gathering-enabled for Gathering). */
  locationIds: number[];
};

export type GraphDrop = {
  itemId: number;
  creatureId: number;
  creatureName: string;
  creatureKind: CreatureKind;
  chance: number;
  min: number;
  max: number;
  requiredLevel: number;
  /** Hunting grounds and dungeons that field the creature (enabled ones). */
  places: string[];
  /** The drop and creature are enabled and the creature appears somewhere. */
  available: boolean;
};

export type GraphOffer = {
  itemId: number;
  npcId: number;
  npcName: string;
  settlementName: string;
  price: number;
  /** A rare find, only sold inside its availability window. */
  limited: boolean;
  /** Hidden until a community project completes. */
  gated: boolean;
  available: boolean;
};

/** A quest reward, a quest delivery or a community project requirement. */
export type GraphQuestLink = {
  itemId: number;
  questId: number;
  questName: string;
  npcId: number;
  quantity: number;
  available: boolean;
};

export type GraphProjectNeed = {
  itemId: number;
  projectId: number;
  projectName: string;
  settlementId: number;
  quantity: number;
  available: boolean;
};

export type ItemGraphContent = {
  items: GraphItem[];
  recipes: GraphRecipe[];
  drops: GraphDrop[];
  offers: GraphOffer[];
  questRewards: GraphQuestLink[];
  questDeliveries: GraphQuestLink[];
  projectNeeds: GraphProjectNeed[];
  locations: Array<{ id: number; name: string }>;
  skillRules: SkillItemRules;
};
