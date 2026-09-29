import type { ItemRarity, VocationalActionType } from "~/generated/prisma/enums";
import { adminRequest } from "~/components/admin/fields";
import type { GraphRecipe } from "~/game/itemGraph/content";
import type { ItemGraph } from "~/game/itemGraph/graph";

/**
 * The item graph edits recipes through the same routes and validation as the
 * Vocation resources screens (/api/admin/vocations/resources).
 */
export type RecipeDraft = {
  skill: VocationalActionType;
  name: string;
  itemId: number;
  unlockItemId: number | null;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  rarity: ItemRarity;
  inputs: Array<{ itemId: number; quantity: number }>;
};

export function draftFromRecipe(recipe: GraphRecipe): RecipeDraft {
  return {
    skill: recipe.skill,
    name: recipe.name,
    itemId: recipe.itemId,
    unlockItemId: recipe.unlockItemId,
    requiredSkillLevel: recipe.requiredSkillLevel,
    defaultSeconds: recipe.defaultSeconds,
    yieldPerUnit: recipe.yieldPerUnit,
    xpPerUnit: recipe.xpPerUnit,
    rarity: recipe.rarity,
    inputs: recipe.inputs.map((input) => ({ ...input })),
  };
}

/** Creates (recipeId null) or replaces a recipe; resolves to its id. */
export async function saveRecipe(recipeId: number | null, draft: RecipeDraft): Promise<number> {
  const body = {
    actionType: draft.skill,
    name: draft.name.trim(),
    itemId: draft.itemId,
    requiredRecipeItemId: draft.unlockItemId,
    requiredSkillLevel: draft.requiredSkillLevel,
    defaultSeconds: draft.defaultSeconds,
    yieldPerUnit: draft.yieldPerUnit,
    xpPerUnit: draft.xpPerUnit,
    rarity: draft.rarity,
    requirements: draft.inputs.map((input) => ({ itemId: input.itemId, quantityPerUnit: input.quantity })),
  };
  const json = await adminRequest(
    recipeId === null ? "/api/admin/vocations/resources" : `/api/admin/vocations/resources/${recipeId}`,
    recipeId === null ? "POST" : "PATCH",
    body,
  );
  return Number(json?.id ?? recipeId);
}

export async function setRecipeLocations(recipeId: number, locationIds: number[]) {
  await adminRequest(`/api/admin/vocations/resources/${recipeId}/locations`, "PATCH", { locationIds });
}

/** Every item downstream of `itemId`: adding one of them as its input closes a circle. */
export function downstreamOf(graph: ItemGraph, itemId: number) {
  const seen = new Set<number>([itemId]);
  const queue = [itemId];
  while (queue.length > 0) {
    for (const link of graph.outputs.get(queue.pop()!) ?? []) {
      if (!seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
      }
    }
  }
  return seen;
}
