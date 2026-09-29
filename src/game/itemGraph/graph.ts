import { CreatureKind, VocationalActionType } from "~/generated/prisma/enums";
import type {
  GraphDrop,
  GraphItem,
  GraphOffer,
  GraphProjectNeed,
  GraphQuestLink,
  GraphRecipe,
  ItemGraphContent,
} from "./content";
import {
  GATHERING_SKILLS,
  isMaterialType,
  itemCategory,
  type ItemCategory,
  type ItemRole,
  type SourceKind,
} from "./taxonomy";

/**
 * A directed link from an input item to the item it helps produce:
 * INGREDIENT is consumed per recipe unit, UNLOCK is a RECIPE item learned
 * once, SEED is a seed planted to grow the produce.
 */
export type LinkKind = "INGREDIENT" | "UNLOCK" | "SEED";

export type GraphLink = {
  from: number;
  to: number;
  kind: LinkKind;
  skill: VocationalActionType;
  quantity: number;
  recipeId: number | null;
};

export type ItemSource =
  | {
      kind: "CRAFTED" | "GATHERED";
      skill: VocationalActionType;
      recipe: GraphRecipe;
      available: boolean;
    }
  | {
      kind: "GROWN";
      skill: typeof VocationalActionType.GARDENING;
      seedItemId: number;
      min: number;
      max: number;
      available: boolean;
    }
  | { kind: "DROPPED"; drop: GraphDrop; skill: VocationalActionType | null; available: boolean }
  | { kind: "SOLD"; offer: GraphOffer; skill: null; available: boolean }
  | { kind: "QUEST"; reward: GraphQuestLink; skill: null; available: boolean };

/** Demand for an item that is not a production link. */
export type ItemUse =
  | { kind: "QUEST"; delivery: GraphQuestLink }
  | { kind: "PROJECT"; need: GraphProjectNeed };

export type ItemFacts = {
  category: ItemCategory;
  role: ItemRole;
  /** Crafting depth: 0 unless crafted, else one more than its deepest ingredient. */
  tier: number;
  /** Produced by a crafting (non-gathering) recipe. */
  crafted: boolean;
  sourceKinds: SourceKind[];
  /** Skills that produce it: recipe skills, Gardening, Hunting for animal drops. */
  skills: VocationalActionType[];
  /** Some source can actually be completed with obtainable inputs. */
  obtainable: boolean;
  /** Distinct items this one is a direct input of. */
  usedBy: number;
  /** Quest deliveries and community project requirements. */
  otherUses: number;
  /** Distinct items it eventually leads to. */
  reach: number;
  /** Distinct items needed somewhere upstream of it. */
  upstream: number;
  /** Part of a circular dependency. */
  inCycle: boolean;
};

export type ItemGraph = {
  content: ItemGraphContent;
  items: Map<number, GraphItem>;
  recipes: Map<number, GraphRecipe>;
  recipeByItem: Map<number, GraphRecipe>;
  links: GraphLink[];
  /** Links into an item: what it needs. */
  inputs: Map<number, GraphLink[]>;
  /** Links out of an item: what it feeds. */
  outputs: Map<number, GraphLink[]>;
  sources: Map<number, ItemSource[]>;
  uses: Map<number, ItemUse[]>;
  facts: Map<number, ItemFacts>;
  /** Groups of items that depend on each other in a circle (incl. self-links). */
  cycles: number[][];
};

const EMPTY: never[] = [];

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function isCraftingSkill(skill: VocationalActionType) {
  return !GATHERING_SKILLS.has(skill);
}

export function buildItemGraph(content: ItemGraphContent): ItemGraph {
  const items = new Map(content.items.map((item) => [item.id, item]));
  const recipes = new Map(content.recipes.map((recipe) => [recipe.id, recipe]));
  const recipeByItem = new Map<number, GraphRecipe>();
  const links: GraphLink[] = [];
  const sources = new Map<number, ItemSource[]>();
  const uses = new Map<number, ItemUse[]>();

  // Links into a missing item template are left out of the graph; the
  // diagnostics report them against the recipe.
  for (const recipe of content.recipes) {
    if (!items.has(recipe.itemId)) continue;
    recipeByItem.set(recipe.itemId, recipe);
    push(sources, recipe.itemId, {
      kind: isCraftingSkill(recipe.skill) ? "CRAFTED" : "GATHERED",
      skill: recipe.skill,
      recipe,
      available: recipe.locationIds.length > 0,
    });
    for (const input of recipe.inputs) {
      if (!items.has(input.itemId)) continue;
      links.push({
        from: input.itemId,
        to: recipe.itemId,
        kind: "INGREDIENT",
        skill: recipe.skill,
        quantity: input.quantity,
        recipeId: recipe.id,
      });
    }
    if (recipe.unlockItemId !== null && items.has(recipe.unlockItemId)) {
      links.push({
        from: recipe.unlockItemId,
        to: recipe.itemId,
        kind: "UNLOCK",
        skill: recipe.skill,
        quantity: 1,
        recipeId: recipe.id,
      });
    }
  }

  for (const item of content.items) {
    if (!item.seed || !items.has(item.seed.yieldItemId)) continue;
    links.push({
      from: item.id,
      to: item.seed.yieldItemId,
      kind: "SEED",
      skill: VocationalActionType.GARDENING,
      quantity: 1,
      recipeId: null,
    });
    push(sources, item.seed.yieldItemId, {
      kind: "GROWN",
      skill: VocationalActionType.GARDENING,
      seedItemId: item.id,
      min: item.seed.min,
      max: item.seed.max,
      available: item.seed.plantable,
    });
  }

  for (const drop of content.drops) {
    if (!items.has(drop.itemId)) continue;
    push(sources, drop.itemId, {
      kind: "DROPPED",
      drop,
      skill: drop.creatureKind === CreatureKind.ANIMAL ? VocationalActionType.HUNTING : null,
      available: drop.available,
    });
  }
  for (const offer of content.offers) {
    if (!items.has(offer.itemId)) continue;
    push(sources, offer.itemId, { kind: "SOLD", offer, skill: null, available: offer.available });
  }
  for (const reward of content.questRewards) {
    if (!items.has(reward.itemId)) continue;
    push(sources, reward.itemId, { kind: "QUEST", reward, skill: null, available: reward.available });
  }
  for (const delivery of content.questDeliveries) {
    push(uses, delivery.itemId, { kind: "QUEST", delivery });
  }
  for (const need of content.projectNeeds) {
    push(uses, need.itemId, { kind: "PROJECT", need });
  }

  const inputs = new Map<number, GraphLink[]>();
  const outputs = new Map<number, GraphLink[]>();
  for (const link of links) {
    push(inputs, link.to, link);
    push(outputs, link.from, link);
  }

  const graph: ItemGraph = {
    content,
    items,
    recipes,
    recipeByItem,
    links,
    inputs,
    outputs,
    sources,
    uses,
    facts: new Map(),
    cycles: [],
  };
  computeFacts(graph);
  return graph;
}

export function inputsOf(graph: ItemGraph, itemId: number): GraphLink[] {
  return graph.inputs.get(itemId) ?? EMPTY;
}

export function outputsOf(graph: ItemGraph, itemId: number): GraphLink[] {
  return graph.outputs.get(itemId) ?? EMPTY;
}

export function sourcesOf(graph: ItemGraph, itemId: number): ItemSource[] {
  return graph.sources.get(itemId) ?? EMPTY;
}

export function usesOf(graph: ItemGraph, itemId: number): ItemUse[] {
  return graph.uses.get(itemId) ?? EMPTY;
}

/** The recipe that crafts an item (not a gathering resource), if any. */
export function craftingRecipe(graph: ItemGraph, itemId: number): GraphRecipe | null {
  const recipe = graph.recipeByItem.get(itemId);
  return recipe && isCraftingSkill(recipe.skill) ? recipe : null;
}

/**
 * Strongly connected components of the link graph (iterative Tarjan), in
 * reverse topological order: a component is emitted before any component
 * that links into it.
 */
function stronglyConnected(ids: number[], outputs: Map<number, GraphLink[]>) {
  const index = new Map<number, number>();
  const low = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const components: number[][] = [];
  let counter = 0;

  for (const start of ids) {
    if (index.has(start)) continue;
    const work: Array<{ id: number; next: number }> = [{ id: start, next: 0 }];
    index.set(start, counter);
    low.set(start, counter);
    counter += 1;
    stack.push(start);
    onStack.add(start);

    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const out = outputs.get(frame.id) ?? EMPTY;
      if (frame.next < out.length) {
        const target = out[frame.next]!.to;
        frame.next += 1;
        if (!index.has(target)) {
          index.set(target, counter);
          low.set(target, counter);
          counter += 1;
          stack.push(target);
          onStack.add(target);
          work.push({ id: target, next: 0 });
        } else if (onStack.has(target)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, index.get(target)!));
        }
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low.set(parent.id, Math.min(low.get(parent.id)!, low.get(frame.id)!));
      if (low.get(frame.id) === index.get(frame.id)) {
        const component: number[] = [];
        let member: number;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.id);
        components.push(component);
      }
    }
  }
  return components;
}

function popcount(bits: Uint32Array) {
  let total = 0;
  for (let word of bits) {
    word -= (word >>> 1) & 0x55555555;
    word = (word & 0x33333333) + ((word >>> 2) & 0x33333333);
    total += (((word + (word >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  return total;
}

function computeFacts(graph: ItemGraph) {
  const ids = [...graph.items.keys()];
  const components = stronglyConnected(ids, graph.outputs);
  const componentOf = new Map<number, number>();
  components.forEach((members, c) => members.forEach((id) => componentOf.set(id, c)));

  const cyclic = components.map(
    (members) =>
      members.length > 1 ||
      outputsOf(graph, members[0]!).some((link) => link.to === members[0]),
  );
  graph.cycles = components.filter((_, c) => cyclic[c]);

  // Transitive reach both ways over the component DAG, as bitsets of item
  // positions: O(links × items / 32) instead of one search per item.
  const position = new Map(ids.map((id, i) => [id, i]));
  const words = Math.ceil(ids.length / 32) || 1;
  const down = components.map(() => new Uint32Array(words));
  const up = components.map(() => new Uint32Array(words));
  const mark = (bits: Uint32Array, id: number) => {
    const p = position.get(id)!;
    bits[p >>> 5] |= 1 << (p & 31);
  };
  const merge = (into: Uint32Array, from: Uint32Array) => {
    for (let w = 0; w < words; w += 1) into[w] |= from[w]!;
  };

  // Emission order is sinks first, so every target component is complete.
  components.forEach((members, c) => {
    for (const id of members) {
      for (const link of outputsOf(graph, id)) {
        const target = componentOf.get(link.to)!;
        if (target === c) continue;
        for (const member of components[target]!) mark(down[c]!, member);
        merge(down[c]!, down[target]!);
      }
    }
  });
  for (let c = components.length - 1; c >= 0; c -= 1) {
    for (const id of components[c]!) {
      for (const link of inputsOf(graph, id)) {
        const origin = componentOf.get(link.from)!;
        if (origin === c) continue;
        for (const member of components[origin]!) mark(up[c]!, member);
        merge(up[c]!, up[origin]!);
      }
    }
  }

  // Tiers along ingredient links, ingredients first (reverse emission order).
  const tier = new Map<number, number>();
  for (let c = components.length - 1; c >= 0; c -= 1) {
    const members = components[c]!;
    let componentTier = 0;
    for (const id of members) {
      const recipe = craftingRecipe(graph, id);
      if (!recipe) continue;
      let deepest = -1;
      for (const link of inputsOf(graph, id)) {
        if (link.kind !== "INGREDIENT" || componentOf.get(link.from) === c) continue;
        deepest = Math.max(deepest, tier.get(link.from) ?? 0);
      }
      componentTier = Math.max(componentTier, deepest + 1);
    }
    for (const id of members) tier.set(id, craftingRecipe(graph, id) ? componentTier : 0);
  }

  const obtainable = computeObtainable(graph);

  for (const id of ids) {
    const item = graph.items.get(id)!;
    const c = componentOf.get(id)!;
    const itemSources = sourcesOf(graph, id);
    const crafted = craftingRecipe(graph, id) !== null;
    const feeds = outputsOf(graph, id);
    const role: ItemRole = crafted
      ? feeds.length > 0
        ? "INTERMEDIATE"
        : "FINISHED"
      : feeds.length > 0 || isMaterialType(item.itemType)
        ? "RAW"
        : "FINISHED";
    const skills = new Set<VocationalActionType>();
    for (const source of itemSources) if (source.skill) skills.add(source.skill);
    // The rest of its own cycle lies both upstream and downstream of it.
    const peers = cyclic[c] ? components[c]!.length - 1 : 0;

    graph.facts.set(id, {
      category: itemCategory(item.itemType),
      role,
      tier: tier.get(id) ?? 0,
      crafted,
      sourceKinds: [...new Set(itemSources.map((source) => source.kind))],
      skills: [...skills],
      obtainable: obtainable.has(id),
      usedBy: new Set(feeds.map((link) => link.to)).size,
      otherUses: usesOf(graph, id).length,
      reach: popcount(down[c]!) + peers,
      upstream: popcount(up[c]!) + peers,
      inCycle: cyclic[c]!,
    });
  }
}

/**
 * Items a player can actually get: an enabled drop, offer or quest reward,
 * a plantable seed they can get, or a recipe offered somewhere whose inputs
 * and unlock they can all get. Iterates to a fixpoint.
 */
function computeObtainable(graph: ItemGraph): Set<number> {
  const got = new Set<number>();
  for (const [itemId, list] of graph.sources) {
    if (
      list.some(
        (source) =>
          (source.kind === "DROPPED" || source.kind === "SOLD" || source.kind === "QUEST") &&
          source.available,
      )
    ) {
      got.add(itemId);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [itemId, list] of graph.sources) {
      if (got.has(itemId)) continue;
      const reachable = list.some((source) => {
        if (!source.available) return false;
        if (source.kind === "GROWN") return got.has(source.seedItemId);
        if (source.kind === "CRAFTED" || source.kind === "GATHERED") {
          const { recipe } = source;
          return (
            recipe.inputs.every((input) => got.has(input.itemId)) &&
            (recipe.unlockItemId === null || got.has(recipe.unlockItemId))
          );
        }
        return false;
      });
      if (reachable) {
        got.add(itemId);
        changed = true;
      }
    }
  }
  return got;
}

/**
 * Which neighbours show first when a branch is capped. Needs: the deepest
 * chains. Uses: the items that lead furthest, so the main lines of a hub stay
 * on screen rather than its dead ends.
 */
export function compareItems(graph: ItemGraph, a: number, b: number, direction: "up" | "down" = "up") {
  const fa = graph.facts.get(a);
  const fb = graph.facts.get(b);
  const tier = (fb?.tier ?? 0) - (fa?.tier ?? 0);
  const reach = (fb?.reach ?? 0) - (fa?.reach ?? 0);
  return (
    (direction === "up" ? tier || reach : reach || tier) ||
    (graph.items.get(a)?.name ?? "").localeCompare(graph.items.get(b)?.name ?? "") ||
    a - b
  );
}
