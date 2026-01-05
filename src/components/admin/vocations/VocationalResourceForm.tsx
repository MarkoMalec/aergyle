"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ItemRarity, VocationalActionType } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";

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

export function VocationalResourceForm(props: {
  mode: "create" | "edit";
  resourceId?: number;
  items: ItemOption[];
  initialValues?: Partial<FormValues>;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaults: FormValues = {
    actionType: VocationalActionType.WOODCUTTING,
    name: "",
    itemId: props.items[0]?.id ?? 1,
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

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
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

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to save");
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
      const res = await fetch(`/api/admin/vocations/resources/${props.resourceId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-white/80">Action Type</div>
          <Select
            value={form.watch("actionType")}
            onValueChange={(v) => form.setValue("actionType", v as VocationalActionType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {actionTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-white/80">Resource Name</div>
          <Input {...form.register("name")} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="text-sm text-white/80">Output Item (template)</div>
          <Select
            value={String(form.watch("itemId"))}
            onValueChange={(v) => form.setValue("itemId", Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              {props.items.map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>
                  {i.name} #{i.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-white/50">
            Note: a single Item template can only belong to one vocational resource.
          </div>
        </div>

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
              {actionType === VocationalActionType.FISHING ? "Bait" : "Requirements"}
            </div>
            <div className="text-xs text-white/60">
              {actionType === VocationalActionType.FISHING
                ? "Fishing consumes bait from the selected inventory stack. Optionally restrict to a specific BAIT template."
                : "Inputs consumed per unit (per tick)."}
            </div>
          </div>
          {actionType === VocationalActionType.FISHING ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (baitItems.length === 0) {
                  alert("No BAIT items exist yet. Create an Item with itemType=BAIT first.");
                  return;
                }
                if (fieldArray.fields.length === 0) {
                  fieldArray.append({ itemId: baitItems[0]!.id, quantityPerUnit: 1 });
                }
              }}
            >
              Restrict Bait
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => fieldArray.append({ itemId: props.items[0]?.id ?? 1, quantityPerUnit: 1 })}
            >
              Add Requirement
            </Button>
          )}
        </div>

        {fieldArray.fields.length === 0 ? (
          actionType === VocationalActionType.FISHING ? (
            <div className="rounded-md border border-gray-800/60 bg-gray-900/20 p-4 text-sm text-white/70">
              Any item with type <span className="font-semibold text-white">BAIT</span> can be used.
              Consumption defaults to <span className="font-semibold text-white">1 bait / unit</span> unless you
              add a specific bait requirement.
            </div>
          ) : (
            <div className="text-sm text-white/60">No requirements.</div>
          )
        ) : (
          <div className="space-y-3">
            {fieldArray.fields.map((field, idx) => {
              const itemId = form.watch(`requirements.${idx}.itemId`);
              const item = itemsById.get(Number(itemId));

              const selectableItems =
                actionType === VocationalActionType.FISHING
                  ? baitItems
                  : props.items;

              return (
                <div key={field.id} className="rounded-md border border-gray-800/60 bg-gray-900/20 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                      <div className="text-sm text-white/80">Item</div>
                      <Select
                        value={String(itemId)}
                        onValueChange={(v) => form.setValue(`requirements.${idx}.itemId`, Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableItems.map((i) => (
                            <SelectItem key={i.id} value={String(i.id)}>
                              {i.name} #{i.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-white/50">Selected: {item?.name ?? "—"}</div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm text-white/80">Qty / Unit</div>
                      <Input type="number" {...form.register(`requirements.${idx}.quantityPerUnit`)} />
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

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : props.mode === "create" ? "Create" : "Save"}
        </Button>

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
