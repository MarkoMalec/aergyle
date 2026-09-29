import type { VocationalActionType } from "~/generated/prisma/enums";
import type { GraphRecipe } from "./content";
import { craftingRecipe, type ItemGraph } from "./graph";

/**
 * Bill of materials: what crafting `quantity` of an item takes, all the way
 * down to what is gathered, dropped or bought. Gathering resources are
 * leaves; only crafting recipes expand.
 */

export type BomRow = {
  key: string;
  itemId: number;
  depth: number;
  /** Needed by this branch alone. */
  quantity: number;
  /** The crafting recipe this row expands through; null for a leaf. */
  recipe: GraphRecipe | null;
  /** Recipe units this branch runs. */
  crafts: number;
  children: BomRow[];
  /** The item already appears above itself: a circular dependency. */
  cycle: boolean;
};

export type BomSkillTotal = {
  skill: VocationalActionType;
  crafts: number;
  /** Base seconds, before tool efficiency. */
  seconds: number;
  xp: number;
  highestLevel: number;
};

export type BomTotals = {
  /** Leaves with shared materials pooled across branches. */
  materials: Array<{ itemId: number; quantity: number }>;
  skills: BomSkillTotal[];
  /** RECIPE items to learn, once. */
  unlocks: number[];
  /** Crafted items, the root included. */
  steps: number;
  depth: number;
  /** How many tree rows each item appears in; more than one means shared. */
  occurrences: Map<number, number>;
  /** The tree stopped growing at the row limit. */
  truncated: boolean;
};

export const BOM_ROW_LIMIT = 4_000;

export function billOfMaterials(
  graph: ItemGraph,
  itemId: number,
  quantity: number,
  rowLimit = BOM_ROW_LIMIT,
): { root: BomRow; totals: BomTotals } {
  const occurrences = new Map<number, number>();
  let rows = 0;
  let truncated = false;
  let depthReached = 0;

  const grow = (id: number, need: number, depth: number, path: Set<number>, key: string): BomRow => {
    rows += 1;
    depthReached = Math.max(depthReached, depth);
    occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
    const recipe = craftingRecipe(graph, id);
    const cycle = path.has(id);
    const row: BomRow = { key, itemId: id, depth, quantity: need, recipe: null, crafts: 0, children: [], cycle };
    if (!recipe || cycle) return row;
    row.recipe = recipe;
    row.crafts = Math.ceil(need / Math.max(1, recipe.yieldPerUnit));
    if (rows >= rowLimit) {
      truncated = true;
      return row;
    }
    const nextPath = new Set(path).add(id);
    row.children = recipe.inputs
      .filter((input) => graph.items.has(input.itemId))
      .map((input) =>
        grow(input.itemId, row.crafts * input.quantity, depth + 1, nextPath, `${key}/${input.itemId}`),
      );
    return row;
  };
  const root = grow(itemId, quantity, 0, new Set(), `${itemId}`);

  return { root, totals: { ...pooledTotals(graph, itemId, quantity), occurrences, truncated, depth: depthReached } };
}

/**
 * Totals with each intermediate crafted once for all the branches that need
 * it, so rounding up to whole recipe units happens once per item.
 */
function pooledTotals(graph: ItemGraph, itemId: number, quantity: number) {
  // Consumers before their inputs: reverse post-order of a DFS down the recipes.
  const order: number[] = [];
  const state = new Map<number, "open" | "done">();
  const visit = (id: number) => {
    if (state.has(id)) return;
    state.set(id, "open");
    for (const input of craftingRecipe(graph, id)?.inputs ?? []) {
      if (graph.items.has(input.itemId) && state.get(input.itemId) !== "open") visit(input.itemId);
    }
    state.set(id, "done");
    order.push(id);
  };
  visit(itemId);
  order.reverse();

  const demand = new Map<number, number>([[itemId, quantity]]);
  const skills = new Map<VocationalActionType, BomSkillTotal>();
  const unlocks = new Set<number>();
  const materials: Array<{ itemId: number; quantity: number }> = [];
  let steps = 0;
  for (const id of order) {
    const need = demand.get(id) ?? 0;
    const recipe = craftingRecipe(graph, id);
    if (!recipe) {
      if (need > 0) materials.push({ itemId: id, quantity: need });
      continue;
    }
    steps += 1;
    const crafts = Math.ceil(need / Math.max(1, recipe.yieldPerUnit));
    const total = skills.get(recipe.skill) ?? {
      skill: recipe.skill,
      crafts: 0,
      seconds: 0,
      xp: 0,
      highestLevel: 0,
    };
    total.crafts += crafts;
    total.seconds += crafts * recipe.defaultSeconds;
    total.xp += crafts * recipe.xpPerUnit;
    total.highestLevel = Math.max(total.highestLevel, recipe.requiredSkillLevel);
    skills.set(recipe.skill, total);
    if (recipe.unlockItemId !== null) unlocks.add(recipe.unlockItemId);
    for (const input of recipe.inputs) {
      if (!graph.items.has(input.itemId) || input.itemId === id) continue;
      demand.set(input.itemId, (demand.get(input.itemId) ?? 0) + crafts * input.quantity);
    }
  }

  materials.sort((a, b) => b.quantity - a.quantity || a.itemId - b.itemId);
  return {
    materials,
    skills: [...skills.values()].sort((a, b) => b.seconds - a.seconds),
    unlocks: [...unlocks],
    steps,
  };
}
