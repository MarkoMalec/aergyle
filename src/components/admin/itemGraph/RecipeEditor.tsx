"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { ItemRarity, ItemType, VocationalActionType } from "~/generated/prisma/enums";
import { adminRequest, Field, inputClass, NumberInput } from "~/components/admin/fields";
import { SearchSelect } from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import {
  acceptsItemType,
  CRAFTING_RULES,
  getCraftingRule,
  getResourceSkillConflict,
  getSkillLabel,
} from "~/game/crafting";
import type { GraphRecipe } from "~/game/itemGraph/content";
import type { ItemGraph } from "~/game/itemGraph/graph";
import { cn } from "~/lib/utils";
import { itemOptions, QuickItemDialog, RESOURCE_SKILLS, Warning, type NewItem } from "./ChainDialogs";
import { downstreamOf, draftFromRecipe, saveRecipe, type RecipeDraft } from "./recipeApi";

/** The crafting skill whose rules accept the item's type, for a new recipe. */
function guessSkill(graph: ItemGraph, itemType: ItemType | null): VocationalActionType {
  const crafting = Object.keys(CRAFTING_RULES) as VocationalActionType[];
  const ruled = crafting.find((skill) => {
    const types = graph.content.skillRules[skill]?.outputTypes ?? [];
    return types.length > 0 && acceptsItemType(types, itemType);
  });
  return ruled ?? VocationalActionType.BLACKSMITHING;
}

/**
 * Edits one item's recipe in place: skill, pace, ingredients and quantities.
 * Saves through the Vocation resources API, which applies the skill rules.
 */
export function RecipeEditor(props: {
  graph: ItemGraph;
  itemId: number;
  recipe: GraphRecipe | null;
  onClose: () => void;
  /** After a save; `created` when the recipe is new (it has no locations yet). */
  onSaved: (recipeId: number, created: boolean) => void;
}) {
  const { graph } = props;
  const router = useRouter();
  const item = graph.items.get(props.itemId)!;
  const [draft, setDraft] = useState<RecipeDraft>(() =>
    props.recipe
      ? draftFromRecipe(props.recipe)
      : {
          skill: guessSkill(graph, item.itemType),
          name: item.name,
          itemId: item.id,
          unlockItemId: null,
          requiredSkillLevel: 1,
          defaultSeconds: 10,
          yieldPerUnit: 1,
          xpPerUnit: 0,
          rarity: item.rarity,
          inputs: [],
        },
  );
  const [created, setCreated] = useState<NewItem[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<RecipeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const typeOf = (id: number) => graph.items.get(id)?.itemType ?? created.find((c) => c.id === id)?.itemType ?? null;
  const rule = graph.content.skillRules[draft.skill];
  const options = useMemo(() => {
    const listed = itemOptions(graph, (candidate) => candidate.id !== item.id);
    return [
      ...created.map((c) => ({ id: c.id, name: c.name, image: c.sprite, detail: "new" })),
      ...listed,
    ];
  }, [graph, item.id, created]);
  const inputOptions = (selected: number) =>
    options.filter(
      (option) =>
        option.id === selected ||
        (draft.skill === VocationalActionType.FISHING
          ? typeOf(option.id) === ItemType.BAIT
          : acceptsItemType(rule?.inputTypes, typeOf(option.id))),
    );
  const recipeItems = options.filter((option) => typeOf(option.id) === ItemType.RECIPE);
  const downstream = useMemo(() => downstreamOf(graph, item.id), [graph, item.id]);

  const circular = draft.inputs.filter((input) => downstream.has(input.itemId));
  const duplicate = new Set(draft.inputs.map((input) => input.itemId)).size !== draft.inputs.length;
  const conflict = getResourceSkillConflict({
    actionType: draft.skill,
    outputType: item.itemType,
    requirementTypes: draft.inputs.map((input) => typeOf(input.itemId)),
    hasRecipeGate: draft.unlockItemId !== null,
    itemRules: graph.content.skillRules,
  });
  const allowsUnlock = getCraftingRule(draft.skill)?.allowsLearnedRecipes ?? false;

  const save = async () => {
    if (circular.length > 0 && !window.confirm(`${circular.map((c) => graph.items.get(c.itemId)?.name).join(", ")} is made from ${item.name}. Save the circular recipe anyway?`)) {
      return;
    }
    setBusy(true);
    try {
      const recipeId = await saveRecipe(props.recipe?.id ?? null, draft);
      toast.success(props.recipe ? "Recipe saved" : "Recipe created");
      props.onSaved(recipeId, !props.recipe);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the recipe");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!props.recipe || !window.confirm(`Delete the recipe for ${item.name}? The item itself stays.`)) return;
    setBusy(true);
    try {
      await adminRequest(`/api/admin/vocations/resources/${props.recipe.id}`, "DELETE");
      toast.success("Recipe deleted");
      props.onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the recipe");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg bg-white/[0.03] p-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Skill">
          <select className={inputClass} value={draft.skill} onChange={(e) => set({ skill: e.target.value as VocationalActionType })}>
            {RESOURCE_SKILLS.map((skill) => (
              <option key={skill} value={skill}>
                {getSkillLabel(skill)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Skill level">
          <NumberInput className={inputClass} min={1} value={draft.requiredSkillLevel} onValueChange={(v) => set({ requiredSkillLevel: Math.max(1, v ?? 1) })} />
        </Field>
        <Field label="Seconds / craft">
          <NumberInput className={inputClass} min={1} value={draft.defaultSeconds} onValueChange={(v) => set({ defaultSeconds: Math.max(1, v ?? 1) })} />
        </Field>
        <Field label="Yield / craft">
          <NumberInput className={inputClass} min={1} value={draft.yieldPerUnit} onValueChange={(v) => set({ yieldPerUnit: Math.max(1, v ?? 1) })} />
        </Field>
        <Field label="XP / craft">
          <NumberInput className={inputClass} min={0} value={draft.xpPerUnit} onValueChange={(v) => set({ xpPerUnit: Math.max(0, v ?? 0) })} />
        </Field>
        <Field label="Rarity">
          <select className={inputClass} value={draft.rarity} onChange={(e) => set({ rarity: e.target.value as ItemRarity })}>
            {Object.values(ItemRarity).map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Recipe name" className="col-span-2">
          <input className={inputClass} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        {allowsUnlock || draft.unlockItemId !== null ? (
          <Field label="Learn first" className="col-span-2" hint={allowsUnlock ? "Hidden until the character learns this RECIPE item." : `${getSkillLabel(draft.skill)} has no learned recipes; clear it to save.`}>
            <SearchSelect options={recipeItems} value={draft.unlockItemId} onChange={(id) => set({ unlockItemId: id })} noneLabel="Nothing (starter recipe)" />
          </Field>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-white/70">
          {draft.skill === VocationalActionType.FISHING ? "Bait" : "Ingredients per craft"}
        </div>
        {draft.inputs.map((input, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <SearchSelect
              className="min-w-0 flex-1"
              options={inputOptions(input.itemId)}
              value={input.itemId}
              onChange={(id) =>
                id !== null && set({ inputs: draft.inputs.map((row, i) => (i === index ? { ...row, itemId: id } : row)) })
              }
            />
            <NumberInput
              aria-label="Quantity"
              className={cn(inputClass, "w-16 shrink-0 text-right")}
              min={1}
              value={input.quantity}
              onValueChange={(v) =>
                set({ inputs: draft.inputs.map((row, i) => (i === index ? { ...row, quantity: Math.max(1, v ?? 1) } : row)) })
              }
            />
            <button
              type="button"
              aria-label="Remove ingredient"
              onClick={() => set({ inputs: draft.inputs.filter((_, i) => i !== index) })}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const listed = new Set(draft.inputs.map((input) => input.itemId));
              const next = inputOptions(-1).find((option) => !listed.has(option.id));
              if (next) set({ inputs: [...draft.inputs, { itemId: next.id, quantity: 1 }] });
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Ingredient
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setQuickOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New item as ingredient
          </Button>
        </div>
      </div>

      {conflict ? <Warning>{conflict}.</Warning> : null}
      {duplicate ? <Warning>An ingredient is listed twice.</Warning> : null}
      {circular.length > 0 ? (
        <Warning>
          {circular.map((c) => graph.items.get(c.itemId)?.name).join(", ")} {circular.length === 1 ? "is" : "are"} made from {item.name}: a circular dependency.
        </Warning>
      ) : null}

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || duplicate} onClick={save}>
          {props.recipe ? "Save recipe" : "Create recipe"}
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onClose}>
          Cancel
        </Button>
        {props.recipe ? (
          <Button size="sm" variant="ghost" className="ml-auto text-red-300 hover:text-red-200" disabled={busy} onClick={remove}>
            Delete
          </Button>
        ) : null}
      </div>

      <QuickItemDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        like={item}
        onCreated={(created) => {
          setCreated((list) => [...list, created]);
          setDraft((d) => ({ ...d, inputs: [...d.inputs, { itemId: created.id, quantity: 1 }] }));
        }}
      />
    </div>
  );
}
