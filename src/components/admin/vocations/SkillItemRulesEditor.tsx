"use client";

import React from "react";
import toast from "react-hot-toast";
import { ChevronDown } from "lucide-react";
import { ItemType, VocationalActionType } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import {
  acceptsItemType,
  getSkillLabel,
  type SkillItemRule,
  sortItemTypes,
} from "~/game/crafting";
import { cn } from "~/lib/utils";

// Resources of a skill per item type they output or require, so the editor
// can show which types are in use.
export type SkillRuleUsage = {
  outputs: Partial<Record<ItemType, number>>;
  inputs: Partial<Record<ItemType, number>>;
};

const EMPTY_RULE: SkillItemRule = { outputTypes: [], inputTypes: [] };

// Display grouping only; a type missing here still shows, under the last group.
const ITEM_TYPE_GROUPS: { label: string; types: ItemType[] }[] = [
  {
    label: "Weapons & tools",
    types: [
      ItemType.SWORD,
      ItemType.GREATSWORD,
      ItemType.AXE,
      ItemType.GREATAXE,
      ItemType.DAGGER,
      ItemType.MACE,
      ItemType.SPEAR,
      ItemType.FLAIL,
      ItemType.BOW,
      ItemType.CROSSBOW,
      ItemType.STAFF,
      ItemType.WAND,
      ItemType.SHIELD,
      ItemType.FELLING_AXE,
      ItemType.PICKAXE,
      ItemType.FISHING_ROD,
      ItemType.HOE,
    ],
  },
  {
    label: "Armor & accessories",
    types: [
      ItemType.HELMET,
      ItemType.CHESTPLATE,
      ItemType.GREAVES,
      ItemType.BOOTS,
      ItemType.GLOVES,
      ItemType.PAULDRONS,
      ItemType.BRACERS,
      ItemType.BELT,
      ItemType.RING,
      ItemType.AMULET,
      ItemType.NECKLACE,
      ItemType.BACKPACK,
    ],
  },
  {
    label: "Consumables",
    types: [ItemType.POTION, ItemType.ELIXIR, ItemType.FOOD, ItemType.SCROLL],
  },
  {
    label: "Resources & materials",
    types: [
      ItemType.ORE,
      ItemType.INGOT,
      ItemType.LOG,
      ItemType.HERB,
      ItemType.FISH,
      ItemType.MEAT,
      ItemType.VEGETABLE,
      ItemType.HIDE,
      ItemType.STONE,
      ItemType.GEM,
      ItemType.MATERIAL,
      ItemType.BAIT,
      ItemType.SEED,
    ],
  },
  {
    label: "Other",
    types: [
      ItemType.RECIPE,
      ItemType.BLUEPRINT,
      ItemType.QUEST_ITEM,
      ItemType.KEY,
      ItemType.CURRENCY,
      ItemType.PET,
      ItemType.MOUNT,
      ItemType.OTHER,
    ],
  },
];
const groupedTypes = new Set(ITEM_TYPE_GROUPS.flatMap((group) => group.types));
ITEM_TYPE_GROUPS[ITEM_TYPE_GROUPS.length - 1]!.types.push(
  ...Object.values(ItemType).filter((itemType) => !groupedTypes.has(itemType)),
);

export function describeItemTypes(itemTypes: readonly ItemType[]) {
  return itemTypes.length === 0 ? "any type" : itemTypes.join(", ");
}

function sameTypes(a: readonly ItemType[], b: readonly ItemType[]) {
  return a.join(",") === sortItemTypes(b).join(",");
}

function ItemTypePicker(props: {
  title: string;
  hint: string;
  selected: ItemType[];
  usage: Partial<Record<ItemType, number>> | undefined;
  disabled: boolean;
  onChange: (next: ItemType[]) => void;
}) {
  const { selected, usage } = props;
  const toggle = (itemType: ItemType) =>
    props.onChange(
      selected.includes(itemType)
        ? selected.filter((entry) => entry !== itemType)
        : sortItemTypes([...selected, itemType]),
    );

  return (
    <fieldset className="space-y-3" disabled={props.disabled}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <legend className="text-sm font-semibold text-white">
            {props.title}
          </legend>
          <p className="text-xs text-white/60">{props.hint}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              selected.length === 0 ? "text-emerald-300" : "text-white/60"
            }
          >
            {selected.length === 0
              ? "Accepts any item type"
              : `${selected.length} type${selected.length === 1 ? "" : "s"} allowed`}
          </span>
          {selected.length > 0 ? (
            <button
              type="button"
              className="text-white/60 underline-offset-2 hover:text-white hover:underline"
              onClick={() => props.onChange([])}
            >
              Allow any
            </button>
          ) : null}
        </div>
      </div>

      {ITEM_TYPE_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-white/40">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.types.map((itemType) => {
              const on = selected.includes(itemType);
              const inUse = usage?.[itemType] ?? 0;
              const refused = inUse > 0 && !acceptsItemType(selected, itemType);
              return (
                <button
                  key={itemType}
                  type="button"
                  aria-pressed={on}
                  title={
                    inUse > 0
                      ? `${inUse} resource${inUse === 1 ? "" : "s"} of this skill use ${itemType}`
                      : undefined
                  }
                  onClick={() => toggle(itemType)}
                  className={cn(
                    "rounded-md px-2 py-1 font-mono text-xs transition-colors",
                    on
                      ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/50 hover:bg-emerald-500/30"
                      : "bg-gray-800/60 text-white/60 hover:bg-gray-800 hover:text-white",
                    refused && "text-amber-200 ring-1 ring-amber-400/60",
                  )}
                >
                  {itemType}
                  {inUse > 0 ? (
                    <span className="ml-1.5 text-white/50">{inUse}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

/**
 * Edits which item types one skill's resources may output and require. Saved
 * on its own; the resource form and /admin/vocations/rules both use it.
 */
export function SkillItemRulesEditor(props: {
  actionType: VocationalActionType;
  rule: SkillItemRule | undefined;
  usage?: SkillRuleUsage;
  onSaved?: (rule: SkillItemRule) => void;
}) {
  const skill = getSkillLabel(props.actionType);
  const [saved, setSaved] = React.useState(props.rule ?? EMPTY_RULE);
  const [outputs, setOutputs] = React.useState(saved.outputTypes);
  const [inputs, setInputs] = React.useState(saved.inputTypes);
  const [isSaving, setIsSaving] = React.useState(false);

  // Fishing's only requirement is its bait slot, fixed by the engine.
  const fixedInputs = props.actionType === VocationalActionType.FISHING;
  const isDirty =
    !sameTypes(saved.outputTypes, outputs) ||
    !sameTypes(saved.inputTypes, inputs);

  const refusedInUse = (
    usage: Partial<Record<ItemType, number>> | undefined,
    allowed: ItemType[],
  ) =>
    Object.entries(usage ?? {}).filter(
      ([itemType]) => !acceptsItemType(allowed, itemType as ItemType),
    );
  const refused = [
    ...refusedInUse(props.usage?.outputs, outputs),
    ...(fixedInputs ? [] : refusedInUse(props.usage?.inputs, inputs)),
  ];

  const save = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/admin/vocations/rules/${props.actionType}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outputTypes: outputs, inputTypes: inputs }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | (SkillItemRule & { error?: string })
        | null;
      if (!response.ok || !body) {
        throw new Error(body?.error ?? "Unable to save rules");
      }
      const next = {
        outputTypes: body.outputTypes,
        inputTypes: body.inputTypes,
      };
      setSaved(next);
      setOutputs(next.outputTypes);
      setInputs(next.inputTypes);
      toast.success(`${skill} rules saved`);
      props.onSaved?.(next);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save rules",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ItemTypePicker
        title="Outputs"
        hint={`Item types ${skill} resources can produce.`}
        selected={outputs}
        usage={props.usage?.outputs}
        disabled={isSaving}
        onChange={setOutputs}
      />

      {fixedInputs ? (
        <div className="text-xs text-white/60">
          Requirements: Fishing takes at most one BAIT item, set by the fishing
          engine.
        </div>
      ) : (
        <ItemTypePicker
          title="Requirements"
          hint={`Item types ${skill} resources can consume.`}
          selected={inputs}
          usage={props.usage?.inputs}
          disabled={isSaving}
          onChange={setInputs}
        />
      )}

      {refused.length > 0 ? (
        <div className="text-xs text-amber-300">
          Existing {skill} resources use{" "}
          {refused.map(([itemType]) => itemType).join(", ")}, which this rule no
          longer allows. They keep working, but have to be changed before they
          can be saved or moved again.
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="button" disabled={!isDirty || isSaving} onClick={save}>
          {isSaving ? "Saving..." : "Save rules"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!isDirty || isSaving}
          onClick={() => {
            setOutputs(saved.outputTypes);
            setInputs(saved.inputTypes);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

/** One skill on /admin/vocations/rules; opens itself when the URL names it. */
export function SkillItemRulesSection(props: {
  actionType: VocationalActionType;
  rule: SkillItemRule | undefined;
  usage: SkillRuleUsage;
  resourceCount: number;
}) {
  const [rule, setRule] = React.useState(props.rule ?? EMPTY_RULE);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    if (window.location.hash !== `#${props.actionType}`) return;
    setOpen(true);
    ref.current?.scrollIntoView({ block: "start" });
  }, [props.actionType]);

  return (
    <details
      ref={ref}
      id={props.actionType}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group scroll-mt-4 overflow-hidden rounded-lg border border-gray-800/60 bg-gray-900/30"
    >
      <summary className="cursor-pointer select-none list-none bg-gray-900/40 px-4 py-3 text-sm text-white/90 hover:bg-gray-900/50 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            <span className="font-semibold">{props.actionType}</span>
            <span className="truncate text-xs text-white/60">
              Outputs: {describeItemTypes(rule.outputTypes)}
              {props.actionType === VocationalActionType.FISHING
                ? null
                : ` · Requirements: ${describeItemTypes(rule.inputTypes)}`}
            </span>
          </div>
          <div className="shrink-0 text-xs text-white/60">
            {props.resourceCount} resources
          </div>
        </div>
      </summary>
      <div className="p-4">
        <SkillItemRulesEditor
          actionType={props.actionType}
          rule={props.rule}
          usage={props.usage}
          onSaved={setRule}
        />
      </div>
    </details>
  );
}
