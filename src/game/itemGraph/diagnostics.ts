import { ItemType } from "~/generated/prisma/enums";
import { getResourceSkillConflict, getSkillLabel } from "~/game/crafting";
import {
  craftingRecipe,
  outputsOf,
  sourcesOf,
  usesOf,
  type ItemGraph,
  type ItemSource,
} from "./graph";
import { isMaterialType } from "./taxonomy";

/**
 * Structural checks over the whole item graph. They inform, they never
 * block: every one of them can be a deliberate design choice.
 */

export type IssueSeverity = "error" | "warning" | "info";

export type IssueCode =
  | "CYCLE"
  | "MISSING_ITEM"
  | "NO_SOURCE"
  | "UNOBTAINABLE"
  | "NO_LOCATION"
  | "RULE_CONFLICT"
  | "DEAD_END"
  | "UNUSED"
  | "DUPLICATE_RECIPE"
  | "SIMILAR_RECIPE"
  | "DEEP_CHAIN"
  | "BOTTLENECK"
  | "LEVEL_INVERSION";

export const ISSUE_TYPES: Record<IssueCode, { title: string; description: string }> = {
  CYCLE: {
    title: "Circular dependency",
    description:
      "Items that need each other, directly or through other recipes, including an item that needs itself. None of them can be made first.",
  },
  MISSING_ITEM: {
    title: "Missing item",
    description: "A recipe points at an item template that no longer exists.",
  },
  NO_SOURCE: {
    title: "No source",
    description: "Nothing crafts, gathers, grows, drops, sells or rewards the item.",
  },
  UNOBTAINABLE: {
    title: "Unobtainable",
    description:
      "Sources exist but none can be completed: switched off, offered at no location, or needing something that can't be obtained.",
  },
  NO_LOCATION: {
    title: "Recipe at no location",
    description:
      "The recipe isn't enabled at any location, so players never see it. The item can still be obtained another way.",
  },
  RULE_CONFLICT: {
    title: "Breaks skill rules",
    description:
      "The recipe no longer fits its skill's item rules (Vocation resources → rules), so it can't be saved as it is.",
  },
  DEAD_END: {
    title: "Dead-end intermediate",
    description: "A crafted material that no recipe, quest or community project uses.",
  },
  UNUSED: {
    title: "Unused material",
    description:
      "A raw material that nothing uses. Fine for vendor goods; otherwise it serves no purpose.",
  },
  DUPLICATE_RECIPE: {
    title: "Identical ingredients",
    description: "Recipes that consume exactly the same set of items.",
  },
  SIMILAR_RECIPE: {
    title: "Similar ingredients",
    description: "Recipes of the same skill that share most of their ingredients.",
  },
  DEEP_CHAIN: {
    title: "Deep chain",
    description: "More crafting steps between raw materials and the item than the depth limit.",
  },
  BOTTLENECK: {
    title: "Bottleneck",
    description:
      "Leads to many items but can be obtained only one way: one change to that source moves all of them.",
  },
  LEVEL_INVERSION: {
    title: "Level inversion",
    description:
      "An ingredient needs a higher level in the same skill than the recipe that consumes it.",
  },
};

export type Issue = {
  code: IssueCode;
  severity: IssueSeverity;
  itemId: number;
  /** Other items involved: cycle members, the similar recipe's item... */
  related: number[];
  message: string;
};

export type DiagnosticOptions = {
  /** Deepest crafting tier before DEEP_CHAIN. */
  maxTier: number;
  /** Ingredient overlap (Jaccard) at which two recipes count as similar. */
  similarity: number;
  /** Reach at which a single-source item counts as a bottleneck. */
  bottleneckReach: number;
};

export function defaultDiagnosticOptions(itemCount: number): DiagnosticOptions {
  return {
    maxTier: 5,
    similarity: 0.75,
    // Most raw materials have one source by design; only the few that a
    // large share of the economy hangs from are worth a look.
    bottleneckReach: Math.max(10, Math.round(itemCount * 0.1)),
  };
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

export function diagnose(graph: ItemGraph, options: DiagnosticOptions): Issue[] {
  const issues: Issue[] = [];
  const name = (id: number) => graph.items.get(id)?.name ?? `#${id}`;
  const facts = (id: number) => graph.facts.get(id)!;

  for (const members of graph.cycles) {
    const path = cyclePath(graph, members);
    issues.push({
      code: "CYCLE",
      severity: "error",
      itemId: members[0]!,
      related: members.slice(1),
      message:
        members.length === 1
          ? `${name(members[0]!)} needs itself`
          : [...path, path[0]!].map(name).join(" → "),
    });
  }

  for (const recipe of graph.content.recipes) {
    const missing = [
      ...recipe.inputs.map((input) => input.itemId),
      ...(recipe.unlockItemId === null ? [] : [recipe.unlockItemId]),
    ].filter((id) => !graph.items.has(id));
    if (!graph.items.has(recipe.itemId) || missing.length > 0) {
      issues.push({
        code: "MISSING_ITEM",
        severity: "error",
        itemId: recipe.itemId,
        related: [],
        message: graph.items.has(recipe.itemId)
          ? `Recipe "${recipe.name}" uses missing item ${missing.map((id) => `#${id}`).join(", ")}`
          : `Recipe "${recipe.name}" produces missing item #${recipe.itemId}`,
      });
    }
    if (!graph.items.has(recipe.itemId)) continue;

    const conflict = getResourceSkillConflict({
      actionType: recipe.skill,
      outputType: graph.items.get(recipe.itemId)!.itemType,
      requirementTypes: recipe.inputs.map((input) => graph.items.get(input.itemId)?.itemType),
      hasRecipeGate: recipe.unlockItemId !== null,
      itemRules: graph.content.skillRules,
    });
    const badUnlock =
      recipe.unlockItemId !== null &&
      graph.items.has(recipe.unlockItemId) &&
      graph.items.get(recipe.unlockItemId)!.itemType !== ItemType.RECIPE;
    if (conflict !== null || badUnlock) {
      issues.push({
        code: "RULE_CONFLICT",
        severity: "warning",
        itemId: recipe.itemId,
        related: badUnlock ? [recipe.unlockItemId!] : [],
        message: conflict ?? `Unlocked by ${name(recipe.unlockItemId!)}, which isn't a RECIPE item`,
      });
    }

    if (recipe.locationIds.length === 0 && facts(recipe.itemId).obtainable) {
      issues.push({
        code: "NO_LOCATION",
        severity: "warning",
        itemId: recipe.itemId,
        related: [],
        message: `${getSkillLabel(recipe.skill)} recipe "${recipe.name}" is enabled at no location`,
      });
    }

    for (const input of recipe.inputs) {
      const inputRecipe = graph.recipeByItem.get(input.itemId);
      if (
        inputRecipe &&
        inputRecipe.skill === recipe.skill &&
        inputRecipe.requiredSkillLevel > recipe.requiredSkillLevel
      ) {
        issues.push({
          code: "LEVEL_INVERSION",
          severity: "warning",
          itemId: recipe.itemId,
          related: [input.itemId],
          message: `Needs ${name(input.itemId)} (${getSkillLabel(recipe.skill)} ${inputRecipe.requiredSkillLevel}) but is itself level ${recipe.requiredSkillLevel}`,
        });
      }
    }
  }

  for (const [id, item] of graph.items) {
    const f = facts(id);
    const sources = sourcesOf(graph, id);
    const feeds = outputsOf(graph, id).length;
    const used = feeds + usesOf(graph, id).length;

    if (sources.length === 0) {
      issues.push({
        code: "NO_SOURCE",
        severity: used > 0 ? "error" : "warning",
        itemId: id,
        related: [],
        message:
          used > 0
            ? `Nothing produces it, yet ${describeDemand(f.usedBy, f.otherUses)}`
            : "Nothing produces it and nothing uses it",
      });
    } else if (!f.obtainable) {
      issues.push({
        code: "UNOBTAINABLE",
        severity: "error",
        itemId: id,
        related: [],
        message: sources.map((source) => blockedReason(graph, source)).slice(0, 3).join("; "),
      });
    }

    if (used === 0 && isMaterialType(item.itemType) && sources.length > 0) {
      issues.push(
        f.crafted
          ? {
              code: "DEAD_END",
              severity: "warning",
              itemId: id,
              related: [],
              message: "Crafted, but nothing uses it",
            }
          : { code: "UNUSED", severity: "info", itemId: id, related: [], message: "Nothing uses it" },
      );
    }

    if (f.tier > options.maxTier) {
      issues.push({
        code: "DEEP_CHAIN",
        severity: "info",
        itemId: id,
        related: [],
        message: `${f.tier} crafting steps deep (limit ${options.maxTier})`,
      });
    }

    const usable = sources.filter((source) => source.available);
    if (f.obtainable && f.reach >= options.bottleneckReach && usable.length === 1) {
      issues.push({
        code: "BOTTLENECK",
        severity: "info",
        itemId: id,
        related: [],
        message: `Leads to ${f.reach} items, obtainable only by ${describeSource(graph, usable[0]!)}`,
      });
    }
  }

  issues.push(...recipeOverlaps(graph, options.similarity));

  return issues.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.code.localeCompare(b.code) ||
      name(a.itemId).localeCompare(name(b.itemId)),
  );
}

function describeDemand(recipes: number, other: number) {
  const parts = [];
  if (recipes > 0) parts.push(`${recipes} item${recipes === 1 ? "" : "s"}`);
  if (other > 0) parts.push(`${other} quest${other === 1 ? "" : "s"} or project${other === 1 ? "" : "s"}`);
  return `${parts.join(" and ")} ${recipes + other === 1 ? "needs" : "need"} it`;
}

export function describeSource(graph: ItemGraph, source: ItemSource): string {
  switch (source.kind) {
    case "CRAFTED":
    case "GATHERED":
      return `${getSkillLabel(source.skill)} (${source.recipe.name})`;
    case "GROWN":
      return `growing ${graph.items.get(source.seedItemId)?.name ?? "a seed"}`;
    case "DROPPED":
      return `${source.drop.creatureName} drops`;
    case "SOLD":
      return `${source.offer.npcName}'s shop`;
    case "QUEST":
      return `quest "${source.reward.questName}"`;
  }
}

/** Why one source of an unobtainable item can't be completed. */
function blockedReason(graph: ItemGraph, source: ItemSource): string {
  const name = (id: number) => graph.items.get(id)?.name ?? `#${id}`;
  const blocked = (id: number) => !graph.facts.get(id)?.obtainable;
  switch (source.kind) {
    case "CRAFTED":
    case "GATHERED": {
      const { recipe } = source;
      if (!source.available) return `${getSkillLabel(recipe.skill)} recipe is at no location`;
      const stuck = recipe.inputs.map((input) => input.itemId).filter(blocked);
      if (recipe.unlockItemId !== null && blocked(recipe.unlockItemId)) stuck.push(recipe.unlockItemId);
      return `needs ${stuck.map(name).join(", ")}, which can't be obtained`;
    }
    case "GROWN":
      return source.available
        ? `seed ${name(source.seedItemId)} can't be obtained`
        : `seed ${name(source.seedItemId)} has no grow or harvest time`;
    case "DROPPED":
      return `${source.drop.creatureName}'s drop is off or it roams nowhere`;
    case "SOLD":
      return `${source.offer.npcName}'s offer is switched off`;
    case "QUEST":
      return `quest "${source.reward.questName}" is switched off`;
  }
}

/** One walk around a cycle, starting at its first member. */
function cyclePath(graph: ItemGraph, members: number[]): number[] {
  const inCycle = new Set(members);
  const start = members[0]!;
  const previous = new Map<number, number>();
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const link of outputsOf(graph, id)) {
      if (!inCycle.has(link.to)) continue;
      if (link.to === start) {
        const path = [id];
        while (path[0] !== start) path.unshift(previous.get(path[0]!)!);
        return path;
      }
      if (!previous.has(link.to)) {
        previous.set(link.to, id);
        queue.push(link.to);
      }
    }
  }
  return members;
}

/** Recipes with identical ingredient sets, and same-skill recipes that mostly overlap. */
function recipeOverlaps(graph: ItemGraph, similarity: number): Issue[] {
  const issues: Issue[] = [];
  const recipes = graph.content.recipes.filter(
    (recipe) => graph.items.has(recipe.itemId) && craftingRecipe(graph, recipe.itemId) === recipe,
  );
  const name = (id: number) => graph.items.get(id)?.name ?? `#${id}`;

  const bySignature = new Map<string, number[]>();
  for (const recipe of recipes) {
    if (recipe.inputs.length === 0) continue;
    const signature = recipe.inputs
      .map((input) => input.itemId)
      .sort((a, b) => a - b)
      .join(",");
    bySignature.set(signature, [...(bySignature.get(signature) ?? []), recipe.itemId]);
  }
  const identical = new Set<string>();
  for (const group of bySignature.values()) {
    if (group.length < 2) continue;
    for (const itemId of group) {
      const others = group.filter((other) => other !== itemId);
      for (const other of others) identical.add(`${Math.min(itemId, other)}:${Math.max(itemId, other)}`);
    }
    issues.push({
      code: "DUPLICATE_RECIPE",
      severity: "warning",
      itemId: group[0]!,
      related: group.slice(1),
      message: `${group.map(name).join(", ")} use the same ingredients`,
    });
  }

  // Candidates share at least one ingredient, found through an index rather
  // than comparing every pair of recipes.
  const usersOf = new Map<number, number[]>();
  recipes.forEach((recipe, index) => {
    for (const input of recipe.inputs) usersOf.set(input.itemId, [...(usersOf.get(input.itemId) ?? []), index]);
  });
  recipes.forEach((recipe, index) => {
    if (recipe.inputs.length < 2) return;
    const shared = new Map<number, number>();
    for (const input of recipe.inputs) {
      for (const other of usersOf.get(input.itemId) ?? []) {
        if (other > index) shared.set(other, (shared.get(other) ?? 0) + 1);
      }
    }
    for (const [other, count] of shared) {
      const peer = recipes[other]!;
      if (peer.skill !== recipe.skill || peer.inputs.length < 2) continue;
      const pair = `${Math.min(recipe.itemId, peer.itemId)}:${Math.max(recipe.itemId, peer.itemId)}`;
      if (identical.has(pair)) continue;
      const overlap = count / (recipe.inputs.length + peer.inputs.length - count);
      if (overlap < similarity) continue;
      issues.push({
        code: "SIMILAR_RECIPE",
        severity: "info",
        itemId: recipe.itemId,
        related: [peer.itemId],
        message: `Shares ${count} of its ingredients with ${name(peer.itemId)} (${Math.round(overlap * 100)}% overlap)`,
      });
    }
  });
  return issues;
}
