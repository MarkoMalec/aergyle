"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { ItemRarity, ItemType, VocationalActionType } from "~/generated/prisma/enums";
import { adminRequest, Field, inputClass, NumberInput } from "~/components/admin/fields";
import { SearchSelect, type SearchOption } from "~/components/admin/SearchSelect";
import { ResourceLocationsEditor } from "~/components/admin/vocations/ResourceLocationsEditor";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getResourceSkillConflict, getSkillLabel, skillHoldsResources } from "~/game/crafting";
import type { GraphItem } from "~/game/itemGraph/content";
import { downstreamOf, draftFromRecipe, saveRecipe, setRecipeLocations } from "./recipeApi";
import type { ItemGraph } from "~/game/itemGraph/graph";
import { Segmented } from "~/components/admin/balance/ui";
import { ItemArt } from "./parts";

export type NewItem = Pick<GraphItem, "id" | "name" | "sprite" | "rarity" | "itemType">;

export const RESOURCE_SKILLS = Object.values(VocationalActionType).filter(skillHoldsResources);

export function itemOptions(graph: ItemGraph, keep?: (item: GraphItem) => boolean): SearchOption[] {
  return [...graph.items.values()]
    .filter((item) => keep?.(item) ?? true)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      image: item.sprite,
      detail: item.itemType?.toLowerCase().replace("_", " ") ?? "untyped",
    }));
}

type QuickItem = {
  name: string;
  itemType: ItemType;
  rarity: ItemRarity;
  sprite: string;
  stackable: boolean;
  price: number;
};

/** The few fields a new chain item needs; the full item form does the rest. */
function QuickItemFields(props: { value: QuickItem; onChange: (value: QuickItem) => void }) {
  const v = props.value;
  const set = (patch: Partial<QuickItem>) => props.onChange({ ...v, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Name" className="col-span-2">
        <input className={inputClass} value={v.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
      </Field>
      <Field label="Type">
        <select className={inputClass} value={v.itemType} onChange={(e) => set({ itemType: e.target.value as ItemType })}>
          {Object.values(ItemType).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rarity">
        <select className={inputClass} value={v.rarity} onChange={(e) => set({ rarity: e.target.value as ItemRarity })}>
          {Object.values(ItemRarity).map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sprite path" className="col-span-2" hint="Borrowed from a neighbour until the item gets its own art.">
        <span className="flex items-center gap-2">
          <ItemArt item={{ sprite: v.sprite, rarity: v.rarity, name: v.name }} size={36} />
          <input className={inputClass} value={v.sprite} onChange={(e) => set({ sprite: e.target.value })} />
        </span>
      </Field>
      <Field label="Vendor price">
        <NumberInput className={inputClass} min={0} value={v.price} onValueChange={(price) => set({ price: price ?? 0 })} />
      </Field>
      <label className="flex items-end gap-2 pb-2 text-xs text-white/70">
        <input type="checkbox" className="h-4 w-4 accent-amber-400" checked={v.stackable} onChange={(e) => set({ stackable: e.target.checked })} />
        Stackable (100)
      </label>
    </div>
  );
}

async function createItem(v: QuickItem): Promise<NewItem> {
  if (!v.name.trim()) throw new Error("The new item needs a name");
  const created = await adminRequest("/api/admin/items", "POST", {
    name: v.name.trim(),
    sprite: v.sprite,
    price: v.price,
    rarity: v.rarity,
    itemType: v.itemType,
    stackable: v.stackable,
    maxStackSize: v.stackable ? 100 : 1,
    requiredLevel: 1,
  });
  return { id: Number(created?.id), name: v.name.trim(), sprite: v.sprite, rarity: v.rarity, itemType: v.itemType };
}

const newQuickItem = (like?: GraphItem): QuickItem => ({
  name: "",
  itemType: ItemType.MATERIAL,
  rarity: like?.rarity ?? ItemRarity.COMMON,
  sprite: like?.sprite ?? "",
  stackable: true,
  price: 1,
});

export function QuickItemDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  like?: GraphItem;
  onCreated: (item: NewItem) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => newQuickItem(props.like));
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Created with the basics; stats and art live in the full item form.</DialogDescription>
        </DialogHeader>
        <QuickItemFields value={value} onChange={setValue} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const item = await createItem(value);
                toast.success(`Created ${item.name}`);
                props.onCreated(item);
                props.onOpenChange(false);
                setValue(newQuickItem(props.like));
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not create the item");
              } finally {
                setBusy(false);
              }
            }}
          >
            Create item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Puts an item between an ingredient and the product that consumes it:
 * ingredient → step → product. The step can be an existing item or a new one,
 * and gets a recipe from the ingredient when it has none.
 */
export function InsertStepDialog(props: {
  graph: ItemGraph;
  productId: number;
  ingredientId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (stepItemId: number) => void;
}) {
  const { graph } = props;
  const router = useRouter();
  const product = graph.items.get(props.productId)!;
  const ingredient = graph.items.get(props.ingredientId)!;
  const productRecipe = graph.recipeByItem.get(props.productId)!;
  const currentQty = productRecipe.inputs.find((input) => input.itemId === props.ingredientId)?.quantity ?? 1;

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existingId, setExistingId] = useState<number | null>(null);
  const [quick, setQuick] = useState(() => newQuickItem(ingredient));
  const [skill, setSkill] = useState(productRecipe.skill);
  const [level, setLevel] = useState(productRecipe.requiredSkillLevel);
  const [seconds, setSeconds] = useState(10);
  const [ingredientQty, setIngredientQty] = useState(currentQty);
  const [stepQty, setStepQty] = useState(1);
  const [sameLocations, setSameLocations] = useState(true);
  const [busy, setBusy] = useState(false);

  const existingRecipe = mode === "existing" && existingId !== null ? graph.recipeByItem.get(existingId) : undefined;
  const needsRecipe = mode === "new" || (existingId !== null && !existingRecipe);
  const stepName = mode === "new" ? quick.name || "New item" : graph.items.get(existingId ?? -1)?.name ?? "…";
  const circular = mode === "existing" && existingId !== null && downstreamOf(graph, props.productId).has(existingId);
  const options = useMemo(
    () => itemOptions(graph, (item) => item.id !== props.productId && item.id !== props.ingredientId),
    [graph, props.productId, props.ingredientId],
  );

  const run = async () => {
    setBusy(true);
    let stage = "create the item";
    try {
      const step =
        mode === "new"
          ? await createItem(quick)
          : existingId !== null
            ? graph.items.get(existingId)!
            : null;
      if (!step) throw new Error("Pick the item to insert");
      if (needsRecipe) {
        stage = `give ${step.name} a recipe`;
        const recipeId = await saveRecipe(null, {
          skill,
          name: step.name,
          itemId: step.id,
          unlockItemId: null,
          requiredSkillLevel: level,
          defaultSeconds: seconds,
          yieldPerUnit: 1,
          xpPerUnit: 0,
          rarity: step.rarity,
          inputs: [{ itemId: props.ingredientId, quantity: ingredientQty }],
        });
        if (sameLocations && productRecipe.locationIds.length > 0) {
          stage = `offer ${step.name} at ${product.name}'s locations`;
          await setRecipeLocations(recipeId, productRecipe.locationIds);
        }
      }
      stage = `swap ${step.name} into ${product.name}'s recipe`;
      const draft = draftFromRecipe(productRecipe);
      draft.inputs = [
        ...draft.inputs.filter((input) => input.itemId !== props.ingredientId && input.itemId !== step.id),
        { itemId: step.id, quantity: stepQty },
      ];
      await saveRecipe(productRecipe.id, draft);
      toast.success(`${ingredient.name} → ${step.name} → ${product.name}`);
      props.onOpenChange(false);
      props.onDone(step.id);
      router.refresh();
    } catch (error) {
      toast.error(`Couldn't ${stage}: ${error instanceof Error ? error.message : "request failed"}`);
      // Anything saved before the failure is real; show it.
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Insert a step</DialogTitle>
          <DialogDescription>
            {product.name} will use the new step instead of {ingredient.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.04] p-3 text-xs text-white/70">
          <span className="flex items-center gap-1.5">
            <ItemArt item={ingredient} size={24} />
            {ingredient.name}
          </span>
          <span className="tabular-nums text-white/40">×{needsRecipe ? ingredientQty : "…"}</span>
          <ArrowRight className="h-3.5 w-3.5 text-white/40" />
          <span className="font-semibold text-amber-200">{stepName}</span>
          <span className="tabular-nums text-white/40">×{stepQty}</span>
          <ArrowRight className="h-3.5 w-3.5 text-white/40" />
          <span className="flex items-center gap-1.5">
            <ItemArt item={product} size={24} />
            {product.name}
          </span>
        </div>

        <Segmented
          label="Step item"
          value={mode}
          onChange={setMode}
          options={[
            { value: "new", label: "New item" },
            { value: "existing", label: "Existing item" },
          ]}
        />
        {mode === "new" ? (
          <QuickItemFields value={quick} onChange={setQuick} />
        ) : (
          <SearchSelect options={options} value={existingId} onChange={setExistingId} placeholder="Find an item…" />
        )}
        {circular ? (
          <Warning>{stepName} is made from {product.name}: this closes a circle.</Warning>
        ) : null}

        {needsRecipe ? (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Step skill">
              <select className={inputClass} value={skill} onChange={(e) => setSkill(e.target.value as VocationalActionType)}>
                {RESOURCE_SKILLS.map((s) => (
                  <option key={s} value={s}>
                    {getSkillLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Skill level">
              <NumberInput className={inputClass} min={1} value={level} onValueChange={(v) => setLevel(Math.max(1, v ?? 1))} />
            </Field>
            <Field label="Seconds">
              <NumberInput className={inputClass} min={1} value={seconds} onValueChange={(v) => setSeconds(Math.max(1, v ?? 1))} />
            </Field>
            <Field label={`${ingredient.name} per craft`} className="col-span-2">
              <NumberInput className={inputClass} min={1} value={ingredientQty} onValueChange={(v) => setIngredientQty(Math.max(1, v ?? 1))} />
            </Field>
            <label className="col-span-3 flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" className="h-4 w-4 accent-amber-400" checked={sameLocations} onChange={(e) => setSameLocations(e.target.checked)} />
              Offer it at the same {productRecipe.locationIds.length} location{productRecipe.locationIds.length === 1 ? "" : "s"} as {product.name}
            </label>
          </div>
        ) : existingRecipe ? (
          <p className="text-xs text-white/50">
            {stepName} keeps its own {getSkillLabel(existingRecipe.skill)} recipe; only {product.name} changes.
          </p>
        ) : null}
        <Field label={`${stepName} per ${product.name} craft`}>
          <NumberInput className={inputClass} min={1} value={stepQty} onValueChange={(v) => setStepQty(Math.max(1, v ?? 1))} />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy || (mode === "existing" && existingId === null)} onClick={run}>
            Insert step
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Adds the item as an ingredient of another item's recipe. */
export function UseInDialog(props: {
  graph: ItemGraph;
  itemId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { graph } = props;
  const router = useRouter();
  const item = graph.items.get(props.itemId)!;
  const [targetId, setTargetId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const options = useMemo(
    () =>
      itemOptions(graph, (candidate) => candidate.id !== props.itemId && graph.recipeByItem.has(candidate.id)).map(
        (option) => ({ ...option, detail: getSkillLabel(graph.recipeByItem.get(option.id)!.skill) }),
      ),
    [graph, props.itemId],
  );
  const target = targetId === null ? undefined : graph.recipeByItem.get(targetId);
  // The item is made from the target: using it there closes a circle.
  const circular = target ? downstreamOf(graph, target.itemId).has(props.itemId) : false;
  const already = target?.inputs.find((input) => input.itemId === props.itemId);
  const conflict = target
    ? getResourceSkillConflict({
        actionType: target.skill,
        outputType: graph.items.get(target.itemId)?.itemType,
        requirementTypes: [...target.inputs.map((i) => graph.items.get(i.itemId)?.itemType), item.itemType],
        hasRecipeGate: target.unlockItemId !== null,
        itemRules: graph.content.skillRules,
      })
    : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Use {item.name} in a recipe</DialogTitle>
          <DialogDescription>Adds it as an ingredient consumed on every craft.</DialogDescription>
        </DialogHeader>
        <Field label="Recipe of">
          <SearchSelect options={options} value={targetId} onChange={setTargetId} placeholder="Find a crafted item…" />
        </Field>
        <Field label={`${item.name} per craft`} hint={already ? `Already uses ${already.quantity}; this replaces the amount.` : undefined}>
          <NumberInput className={inputClass} min={1} value={quantity} onValueChange={(v) => setQuantity(Math.max(1, v ?? 1))} />
        </Field>
        {circular ? <Warning>{item.name} is made from {graph.items.get(targetId!)?.name}: this closes a circle.</Warning> : null}
        {conflict ? <Warning>{conflict}. The save will be refused.</Warning> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || !target}
            onClick={async () => {
              if (!target) return;
              setBusy(true);
              try {
                const draft = draftFromRecipe(target);
                draft.inputs = [...draft.inputs.filter((i) => i.itemId !== props.itemId), { itemId: props.itemId, quantity }];
                await saveRecipe(target.id, draft);
                toast.success(`${graph.items.get(target.itemId)?.name} now uses ${item.name}`);
                props.onOpenChange(false);
                router.refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save");
              } finally {
                setBusy(false);
              }
            }}
          >
            Add ingredient
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Where a recipe is offered: the Vocation resources location editor, in a dialog. */
export function LocationsDialog(props: {
  graph: ItemGraph;
  recipeId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const recipe = props.recipeId === null ? undefined : props.graph.recipes.get(props.recipeId);
  return (
    <Dialog open={props.recipeId !== null} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85svh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Locations{recipe ? ` · ${recipe.name}` : ""}</DialogTitle>
          <DialogDescription>Players only see a recipe at the locations it is enabled at.</DialogDescription>
        </DialogHeader>
        {props.recipeId !== null ? (
          <ResourceLocationsEditor
            resourceId={props.recipeId}
            locations={props.graph.content.locations}
            assigned={(recipe?.locationIds ?? []).map((locationId) => ({ locationId, enabled: true }))}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function Warning(props: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-amber-400/10 px-2.5 py-2 text-xs text-amber-200">
      <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{props.children}</span>
    </div>
  );
}
