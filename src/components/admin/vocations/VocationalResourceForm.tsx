"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ItemRarity,
  ItemType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  acceptsItemType,
  getCraftingRule,
  getResourceSkillConflict,
  getSkillLabel,
  type SkillItemRules,
  skillHoldsResources,
} from "~/game/crafting";
import {
  describeItemTypes,
  SkillItemRulesEditor,
} from "./SkillItemRulesEditor";

const VOCATIONAL_ACTION_TYPE_VALUES = Object.values(VocationalActionType) as [
  VocationalActionType,
  ...VocationalActionType[],
];

const ITEM_RARITY_VALUES = Object.values(ItemRarity) as [
  ItemRarity,
  ...ItemRarity[],
];

const requirementSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  quantityPerUnit: z.coerce.number().int().min(1),
});

const schema = z
  .object({
    actionType: z.enum(VOCATIONAL_ACTION_TYPE_VALUES),
    name: z.string().min(1),
    itemId: z.coerce.number().int().positive(),
    requiredRecipeItemId: z.coerce
      .number()
      .int()
      .positive()
      .nullable()
      .default(null),
    requiredSkillLevel: z.coerce.number().int().min(1).default(1),
    defaultSeconds: z.coerce.number().int().min(1),
    yieldPerUnit: z.coerce.number().int().min(1),
    xpPerUnit: z.coerce.number().int().min(0),
    rarity: z.enum(ITEM_RARITY_VALUES).default(ItemRarity.COMMON),
    requirements: z.array(requirementSchema).default([]),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<number>();
    for (const r of v.requirements) {
      if (seen.has(r.itemId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate requirement item",
          path: ["requirements"],
        });
        break;
      }
      seen.add(r.itemId);
    }
  });

type FormValues = z.infer<typeof schema>;

type ItemOption = { id: number; name: string; itemType?: string | null };

// First message in a react-hook-form error tree, prefixed with its field path.
function firstErrorMessage(errors: unknown, path = ""): string | null {
  if (!errors || typeof errors !== "object") return null;
  const node = errors as Record<string, unknown>;
  if (typeof node.message === "string" && node.message) {
    return path ? `${path}: ${node.message}` : node.message;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "ref" || key === "types") continue;
    const nested = key === "root" ? path : path ? `${path}.${key}` : key;
    const found = firstErrorMessage(value, nested);
    if (found) return found;
  }
  return null;
}

export function VocationalResourceForm(props: {
  mode: "create" | "edit";
  resourceId?: number;
  items: ItemOption[];
  itemRules: SkillItemRules;
  initialValues?: Partial<FormValues>;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const defaults: FormValues = {
    actionType: VocationalActionType.WOODCUTTING,
    name: "",
    itemId: props.items[0]?.id ?? 1,
    requiredRecipeItemId: null,
    requiredSkillLevel: 1,
    defaultSeconds: 10,
    yieldPerUnit: 1,
    xpPerUnit: 0,
    rarity: ItemRarity.COMMON,
    requirements: [],
    ...props.initialValues,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: "requirements",
  });

  const actionTypes = useMemo(() => Object.values(VocationalActionType), []);
  const rarities = useMemo(() => Object.values(ItemRarity), []);
  const actionType = form.watch("actionType");
  const craftingRule = getCraftingRule(actionType);
  const itemRule = props.itemRules[actionType];
  const skillLabel = getSkillLabel(actionType);

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    setFormError(null);
    try {
      const res = await fetch(
        props.mode === "create"
          ? "/api/admin/vocations/resources"
          : `/api/admin/vocations/resources/${props.resourceId}`,
        {
          method: props.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );

      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setFormError(json?.error ?? "Failed to save");
        return;
      }

      router.push("/admin/vocations");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!props.resourceId) return;
    if (!confirm("Delete this vocational resource?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/vocations/resources/${props.resourceId}`,
        {
          method: "DELETE",
        },
      );
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        alert(json?.error ?? "Failed to delete");
        return;
      }

      router.push("/admin/vocations");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const itemsById = useMemo(() => {
    const map = new Map<number, ItemOption>();
    for (const i of props.items) map.set(i.id, i);
    return map;
  }, [props.items]);

  const baitItems = useMemo(() => {
    return props.items.filter((i) => (i.itemType ?? null) === "BAIT");
  }, [props.items]);

  const recipeItems = useMemo(() => {
    return props.items.filter((i) => i.itemType === ItemType.RECIPE);
  }, [props.items]);

  const outputItems = props.items.filter((item) =>
    acceptsItemType(itemRule?.outputTypes, item.itemType as ItemType | null),
  );

  const inputItems = props.items.filter((item) =>
    acceptsItemType(itemRule?.inputTypes, item.itemType as ItemType | null),
  );

  // The skill filters must never hide what is already chosen: the Select would
  // render blank and the value would look reset. The conflict note says why an
  // off-rule choice will not save.
  const withSelected = (options: ItemOption[], selectedId: number) => {
    if (options.some((option) => option.id === selectedId)) return options;
    const selected = itemsById.get(selectedId);
    return selected ? [selected, ...options] : options;
  };

  const itemId = Number(form.watch("itemId"));
  const requiredRecipeItemId = form.watch("requiredRecipeItemId");
  const requirements = form.watch("requirements");
  const skillConflict = getResourceSkillConflict({
    actionType,
    outputType: itemsById.get(itemId)?.itemType as ItemType | undefined,
    requirementTypes: requirements.map(
      (requirement) =>
        itemsById.get(Number(requirement.itemId))?.itemType as
          | ItemType
          | undefined,
    ),
    hasRecipeGate: requiredRecipeItemId !== null,
    itemRules: props.itemRules,
  });

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, (errors) =>
        setFormError(firstErrorMessage(errors) ?? "Check the form"),
      )}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-white/80">Action Type</div>
          {/* Changing the skill changes nothing else: output, recipe and
              requirements stay as they are, and skillConflict flags any that
              the new skill will not accept. */}
          <Select
            value={actionType}
            onValueChange={(v) =>
              form.setValue("actionType", v as VocationalActionType)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {actionTypes.map((t) => (
                <SelectItem
                  key={t}
                  value={t}
                  disabled={!skillHoldsResources(t)}
                >
                  {t}
                  {skillHoldsResources(t) ? null : (
                    <span className="block text-[11px] text-white/50">
                      Players never see resources here
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {skillHoldsResources(actionType) ? (
            <div className="text-xs text-white/60">
              {skillLabel} outputs{" "}
              {describeItemTypes(itemRule?.outputTypes ?? [])}
              {actionType === VocationalActionType.FISHING
                ? null
                : ` and uses ${describeItemTypes(itemRule?.inputTypes ?? [])} as requirements`}
              .{" "}
              <button
                type="button"
                className="text-white/80 underline underline-offset-2 hover:text-white"
                onClick={() => setRulesOpen(true)}
              >
                Change {skillLabel} rules
              </button>
            </div>
          ) : null}
          {skillConflict ? (
            <div className="text-xs text-amber-300">
              {skillConflict}. Adjust the fields below, change the {skillLabel}{" "}
              rules or pick another skill before saving.
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-sm text-white/80">Resource Name</div>
          <Input {...form.register("name")} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="text-sm text-white/80">Output Item (template)</div>
          <Select
            value={String(itemId)}
            onValueChange={(v) => form.setValue("itemId", Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              {withSelected(outputItems, itemId).map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>
                  {i.name} #{i.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-white/50">
            Note: a single Item template can only belong to one vocational
            resource.
          </div>
        </div>

        {/* Kept on screen while a recipe is set, even for a skill without
            recipe gates, so it is cleared on purpose rather than dropped. */}
        {(craftingRule?.allowsLearnedRecipes ?? false) ||
        requiredRecipeItemId !== null ? (
          <div className="space-y-2 md:col-span-2">
            <div className="text-sm text-white/80">Required Recipe</div>
            <Select
              value={String(requiredRecipeItemId ?? "__none")}
              onValueChange={(v) =>
                form.setValue(
                  "requiredRecipeItemId",
                  v === "__none" ? null : Number(v),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select unlock item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">
                  None (visible immediately)
                </SelectItem>
                {(requiredRecipeItemId === null
                  ? recipeItems
                  : withSelected(recipeItems, requiredRecipeItemId)
                ).map((recipe) => (
                  <SelectItem key={recipe.id} value={String(recipe.id)}>
                    {recipe.name} #{recipe.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-white/50">
              {craftingRule?.allowsLearnedRecipes
                ? "The dish remains hidden until the character learns this RECIPE item. Leave empty for a starter recipe."
                : `${actionType} has no recipe gates. Set this to None to save under ${actionType}.`}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-sm text-white/80">Required Skill Level</div>
          <Input type="number" {...form.register("requiredSkillLevel")} />
          <div className="text-xs text-white/50">
            Minimum level required in this vocation skill to start.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-white/80">Seconds / Unit</div>
          <Input type="number" {...form.register("defaultSeconds")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Yield / Unit</div>
          <Input type="number" {...form.register("yieldPerUnit")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">XP / Unit</div>
          <Input type="number" {...form.register("xpPerUnit")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Rarity</div>
          <Select
            value={form.watch("rarity")}
            onValueChange={(v) => form.setValue("rarity", v as ItemRarity)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rarity" />
            </SelectTrigger>
            <SelectContent>
              {rarities.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">
              {actionType === VocationalActionType.FISHING
                ? "Bait"
                : "Requirements"}
            </div>
            <div className="text-xs text-white/60">
              {actionType === VocationalActionType.FISHING
                ? "Fishing consumes bait from the selected inventory stack. Optionally restrict to a specific BAIT template."
                : actionType === VocationalActionType.COOKING
                  ? "Fish, meat and vegetables consumed for each cooked dish."
                  : actionType === VocationalActionType.TAILORING
                    ? "The physical blueprint, cloth, hides and other materials required for each item."
                    : "Inputs consumed per unit (per tick)."}
            </div>
          </div>
          {actionType === VocationalActionType.FISHING ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (baitItems.length === 0) {
                  alert(
                    "No BAIT items exist yet. Create an Item with itemType=BAIT first.",
                  );
                  return;
                }
                if (fieldArray.fields.length === 0) {
                  fieldArray.append({
                    itemId: baitItems[0]!.id,
                    quantityPerUnit: 1,
                  });
                }
              }}
            >
              Restrict Bait
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (inputItems.length === 0) {
                  alert("No valid requirement items exist yet.");
                  return;
                }
                const listed = new Set(
                  requirements.map((requirement) => Number(requirement.itemId)),
                );
                const nextItem = inputItems.find(
                  (item) => !listed.has(item.id),
                );
                if (!nextItem) {
                  alert("Every valid requirement item is already listed.");
                  return;
                }
                fieldArray.append({ itemId: nextItem.id, quantityPerUnit: 1 });
              }}
            >
              Add Requirement
            </Button>
          )}
        </div>

        {fieldArray.fields.length === 0 ? (
          actionType === VocationalActionType.FISHING ? (
            <div className="rounded-md border border-gray-800/60 bg-gray-900/20 p-4 text-sm text-white/70">
              Any item with type{" "}
              <span className="font-semibold text-white">BAIT</span> can be
              used. Consumption defaults to{" "}
              <span className="font-semibold text-white">1 bait / unit</span>{" "}
              unless you add a specific bait requirement.
            </div>
          ) : (
            <div className="text-sm text-white/60">No requirements.</div>
          )
        ) : (
          <div className="space-y-3">
            {fieldArray.fields.map((field, idx) => {
              const requirementItemId = form.watch(
                `requirements.${idx}.itemId`,
              );
              const item = itemsById.get(Number(requirementItemId));

              const selectableItems =
                actionType === VocationalActionType.FISHING
                  ? baitItems
                  : inputItems;

              return (
                <div
                  key={field.id}
                  className="rounded-md border border-gray-800/60 bg-gray-900/20 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                      <div className="text-sm text-white/80">Item</div>
                      <Select
                        value={String(requirementItemId)}
                        onValueChange={(v) =>
                          form.setValue(`requirements.${idx}.itemId`, Number(v))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {withSelected(
                            selectableItems,
                            Number(requirementItemId),
                          ).map((i) => (
                            <SelectItem key={i.id} value={String(i.id)}>
                              {i.name} #{i.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-white/50">
                        Selected: {item?.name ?? "—"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm text-white/80">Qty / Unit</div>
                      <Input
                        type="number"
                        {...form.register(
                          `requirements.${idx}.quantityPerUnit`,
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => fieldArray.remove(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{skillLabel} item rules</DialogTitle>
            <DialogDescription>
              Applies to every {skillLabel} resource. Leave a list empty to
              accept any item type. Also on /admin/vocations/rules.
            </DialogDescription>
          </DialogHeader>
          <SkillItemRulesEditor
            key={actionType}
            actionType={actionType}
            rule={itemRule}
            onSaved={() => {
              setRulesOpen(false);
              // Reloads itemRules from the server; the form keeps its values.
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving
              ? "Saving..."
              : props.mode === "create"
                ? "Create"
                : "Save"}
          </Button>
          {formError ? (
            <div className="text-sm text-red-300">{formError}</div>
          ) : null}
        </div>

        {props.mode === "edit" ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
