"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type FieldErrors, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  BarChart3,
  ChevronLeft,
  FlaskConical,
  Gem,
  Loader2,
  Save,
  Sprout,
  Swords,
  Tag,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  ItemRarity,
  ItemType,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { Segmented } from "~/components/admin/balance/ui";
import { NumberInput } from "~/components/admin/fields";
import {
  ConfirmLeaveContext,
  LEAVE_MESSAGE,
  useLeaveGuard,
} from "~/components/admin/leaveGuard";
import { formatDuration, humanize } from "~/components/admin/players/shared";
import {
  SearchSelect,
  type SearchOption,
} from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { normalizeItemEquipTo } from "~/utils/itemEquipTo";
import {
  ChoicePicker,
  controlClass,
  CsvEditor,
  CsvToggle,
  ErrorNote,
  Field,
  FormSection,
  invalidClass,
  ListEditor,
  ListRow,
  numberClass,
  RarityChip,
  SpriteTile,
  Switch,
  WithSuffix,
} from "./ItemFormControls";
import {
  baseStatsCodec,
  buildPreviewRows,
  clampPercent,
  COMBAT_STAT_TYPES,
  type CsvCodec,
  type CsvField,
  foodEffectStatsCodec,
  itemFormSchema,
  itemFormSnapshot,
  type ItemFormValues,
  type RarityConfigPreview,
  statProgressionsCodec,
  statRarityOverridesCodec,
  toolEfficienciesCodec,
} from "./itemFormModel";
import {
  isPercentStat,
  ITEM_TYPE_OPTIONS,
  rarityColor,
  rarityLabel,
  rarityOptions,
  SKILL_OPTIONS,
  SLOT_OPTIONS,
  slotLabel,
  statLabel,
  statOptions,
} from "./itemFormOptions";
import { type OverrideChange, RarityScalingGrid } from "./RarityScalingGrid";

const ITEM_RARITY_VALUES = Object.values(ItemRarity) as ItemRarity[];
const ALL_STAT_TYPES = Object.values(StatType) as StatType[];
const ALL_ACTION_TYPES = Object.values(
  VocationalActionType,
) as VocationalActionType[];

const FORM_ID = "item-editor-form";

// Picker changes count as edits, like typing does.
const DIRTY = { shouldDirty: true } as const;

const DEFAULT_VALUES: ItemFormValues = {
  name: "",
  sprite: "",
  price: 0,
  description: "",
  rarity: ItemRarity.COMMON,
  itemType: null,
  seedGrowSeconds: null,
  seedYieldItemId: null,
  seedYieldMin: null,
  seedYieldMax: null,
  seedHarvestSeconds: null,
  seedXp: null,
  healingAmount: null,
  foodEffectSeconds: null,
  equipTo: null,
  twoHanded: false,
  stackable: false,
  maxStackSize: 1,
  minPhysicalDamage: null,
  flipNegativeStatsWithRarity: false,
  maxPhysicalDamage: null,
  minMagicDamage: null,
  maxMagicDamage: null,
  armor: null,
  requiredLevel: 1,
  baseStatsCsv: "",
  toolEfficienciesCsv: "",
  statProgressionsCsv: "",
  statRarityOverridesCsv: "",
  foodEffectStatsCsv: "",
};

/** Where each validated field lives, to point the section bar at errors. */
const FIELD_PLACES: Partial<
  Record<keyof ItemFormValues, { label: string; section: string }>
> = {
  name: { label: "Name", section: "general" },
  sprite: { label: "Sprite", section: "general" },
  price: { label: "Price", section: "general" },
  requiredLevel: { label: "Required level", section: "general" },
  maxStackSize: { label: "Stack size", section: "general" },
  minPhysicalDamage: { label: "Physical damage", section: "equipment" },
  maxPhysicalDamage: { label: "Physical damage", section: "equipment" },
  minMagicDamage: { label: "Magic damage", section: "equipment" },
  maxMagicDamage: { label: "Magic damage", section: "equipment" },
  armor: { label: "Armor", section: "equipment" },
  healingAmount: { label: "Instant healing", section: "consumable" },
  foodEffectSeconds: { label: "Effect duration", section: "consumable" },
  seedGrowSeconds: { label: "Grow time", section: "seed" },
  seedHarvestSeconds: { label: "Harvest time", section: "seed" },
  seedYieldMin: { label: "Harvest amount", section: "seed" },
  seedYieldMax: { label: "Harvest amount", section: "seed" },
  seedXp: { label: "Gardening XP", section: "seed" },
};

const BASE_STAT_OPTIONS = statOptions(
  (statType) => !COMBAT_STAT_TYPES.has(statType),
);
const ALL_STAT_OPTIONS = statOptions();

// Proportional tracks with floors: capped tracks would grow before a 1fr
// track, leaving the stat picker no room on a narrow screen.
const BASE_COLUMNS =
  "grid-cols-[minmax(0,1.6fr)_minmax(4.5rem,1fr)_minmax(4.5rem,1fr)_2rem]";
const TOOL_COLUMNS = "grid-cols-[minmax(0,1.6fr)_minmax(4.5rem,1fr)_2rem]";
const UNLOCK_COLUMNS =
  "grid-cols-[minmax(0,1.6fr)_minmax(4rem,0.8fr)_minmax(6rem,1.2fr)_2rem]";
const BONUS_COLUMNS = "grid-cols-[minmax(0,1.6fr)_minmax(4.5rem,1fr)_2rem]";

function errorMessage(json: unknown, fallback: string) {
  return json &&
    typeof json === "object" &&
    "error" in json &&
    typeof json.error === "string"
    ? json.error
    : fallback;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Grows a textarea to show all of its text. */
function fitToContent(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function durationHint(seconds: unknown, fallback: string) {
  const value = toNumber(seconds);
  return value && value > 0
    ? `${formatDuration(value)} · ${fallback}`
    : fallback;
}

/**
 * One balance table edited as rows, or as its raw CSV. The rows are written
 * back to the CSV form field on every change, which is what gets saved.
 */
function useCsvList<Row>(
  form: UseFormReturn<ItemFormValues>,
  field: CsvField,
  codec: CsvCodec<Row>,
  initialCsv: string | undefined,
) {
  const [initial] = useState(() => codec.parse(initialCsv ?? ""));
  const [raw, setRaw] = useState(initial.error !== null);
  const [error, setError] = useState<string | null>(initial.error);
  const [rows, setRowsState] = useState<Row[]>(initial.rows);

  const setRows = (next: Row[]) => {
    setRowsState(next);
    form.setValue(field, codec.toCsv(next), { shouldDirty: true });
  };

  return {
    rows,
    raw,
    error,
    setRows,
    add: (row: Row) => setRows([...rows, row]),
    update: (index: number, patch: Partial<Row>) =>
      setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row))),
    remove: (index: number) => setRows(rows.filter((_, i) => i !== index)),
    /** Leaving CSV applies it, or keeps it open and says what's wrong. */
    toggleRaw: () => {
      if (!raw) {
        setRaw(true);
        setError(null);
        return;
      }
      const parsed = codec.parse(form.getValues(field) ?? "");
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      setError(null);
      setRaw(false);
      setRows(parsed.rows);
    },
  };
}

/** The section nearest the top of the viewport, for the section bar. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  const key = ids.join(",");

  useEffect(() => {
    const list = key.split(",");
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = list[0] ?? "";
      for (const id of list) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= 140) current = id;
      }
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) current = list[list.length - 1] ?? current;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key]);

  return active;
}

type ItemFormProps = {
  mode: "create" | "edit";
  itemId?: number;
  initialValues?: Partial<ItemFormValues>;
  /** The item's place in the crafting chains, shown after the form. */
  chain?: React.ReactNode;
};

export function ItemForm(props: ItemFormProps) {
  // Discarding remounts the editor, which restores every field and list.
  const [revision, setRevision] = useState(0);
  // Whether leaving now would lose edits; the crafting chain asks before it
  // opens another item.
  const unsavedRef = useRef(false);
  const confirmLeave = useCallback(
    () => !unsavedRef.current || window.confirm(LEAVE_MESSAGE),
    [],
  );

  return (
    <ConfirmLeaveContext.Provider value={confirmLeave}>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-12">
        <ItemEditor
          key={revision}
          {...props}
          unsavedRef={unsavedRef}
          onDiscard={() => setRevision((value) => value + 1)}
        />
        {props.chain ? (
          <div id="chain" className="scroll-mt-20">
            {props.chain}
          </div>
        ) : null}
        {props.mode === "edit" && props.itemId ? (
          <DeleteItemSection
            itemId={props.itemId}
            name={
              props.initialValues?.name ? props.initialValues.name : "this item"
            }
          />
        ) : null}
      </div>
    </ConfirmLeaveContext.Provider>
  );
}

function ItemEditor(
  props: ItemFormProps & {
    unsavedRef: React.MutableRefObject<boolean>;
    onDiscard: () => void;
  },
) {
  const router = useRouter();
  const isCreate = props.mode === "create";
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [brokenSprite, setBrokenSprite] = useState<string | null>(null);
  const [seedYieldOptions, setSeedYieldOptions] = useState<
    SearchOption[] | null
  >(null);
  const [rarityConfigs, setRarityConfigs] = useState<
    RarityConfigPreview[] | null
  >(null);
  const [rarityConfigsError, setRarityConfigsError] = useState<string | null>(
    null,
  );

  const [defaults] = useState<ItemFormValues>(() => ({
    ...DEFAULT_VALUES,
    ...props.initialValues,
  }));
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: defaults,
  });
  const values = form.watch();
  const descriptionField = form.register("description");
  const errors = form.formState.errors;

  const baseStats = useCsvList(
    form,
    "baseStatsCsv",
    baseStatsCodec,
    defaults.baseStatsCsv,
  );
  const tools = useCsvList(
    form,
    "toolEfficienciesCsv",
    toolEfficienciesCodec,
    defaults.toolEfficienciesCsv,
  );
  const progressions = useCsvList(
    form,
    "statProgressionsCsv",
    statProgressionsCodec,
    defaults.statProgressionsCsv,
  );
  const overrides = useCsvList(
    form,
    "statRarityOverridesCsv",
    statRarityOverridesCodec,
    defaults.statRarityOverridesCsv,
  );
  const bonuses = useCsvList(
    form,
    "foodEffectStatsCsv",
    foodEffectStatsCodec,
    defaults.foodEffectStatsCsv,
  );

  const initialSnapshot = useMemo(() => itemFormSnapshot(defaults), [defaults]);
  const dirty = itemFormSnapshot(values) !== initialSnapshot;
  const busy = isSaving || saved;

  const slot = normalizeItemEquipTo(values.equipTo);
  const isWeapon = slot === "weapon";
  const isSeedItem = values.itemType === ItemType.SEED;
  const supportsTimedEffect =
    values.itemType === ItemType.FOOD ||
    values.itemType === ItemType.POTION ||
    values.itemType === ItemType.ELIXIR;
  const hasCombatValues = [
    values.minPhysicalDamage,
    values.maxPhysicalDamage,
    values.minMagicDamage,
    values.maxMagicDamage,
    values.armor,
  ].some((value) => (toNumber(value) ?? 0) !== 0);
  const showCombat = slot !== null || hasCombatValues;

  useEffect(() => {
    let active = true;

    // Only fetch when the user actually switches an item to SEED.
    if (!isSeedItem) return;
    if (seedYieldOptions !== null) return;

    void (async () => {
      try {
        const res = await fetch("/api/admin/items", { method: "GET" });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(errorMessage(json, "Failed to load items"));

        const rows = Array.isArray(json) ? (json as unknown[]) : [];
        const parsed = rows
          .map((r) => {
            const o = r as {
              id?: unknown;
              name?: unknown;
              sprite?: unknown;
              itemType?: unknown;
            };
            return {
              id: Number(o.id),
              name: typeof o.name === "string" ? o.name : "",
              image: typeof o.sprite === "string" ? o.sprite : null,
              detail:
                typeof o.itemType === "string"
                  ? humanize(o.itemType)
                  : undefined,
            };
          })
          .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!active) return;
        setSeedYieldOptions(parsed);
      } catch {
        if (!active) return;
        setSeedYieldOptions([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [isSeedItem, seedYieldOptions]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setRarityConfigsError(null);
        const res = await fetch("/api/admin/rarity/config", { method: "GET" });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(errorMessage(json, "Failed to load rarity config"));

        const rows = Array.isArray(json) ? (json as unknown[]) : [];
        const parsed: RarityConfigPreview[] = rows
          .map((r) => {
            const obj = r as {
              rarity?: unknown;
              statMultiplier?: unknown;
              sortOrder?: unknown;
              displayName?: unknown;
              color?: unknown;
            };
            return {
              rarity: obj.rarity as ItemRarity,
              statMultiplier: Number(obj.statMultiplier ?? 1),
              sortOrder: Number(obj.sortOrder ?? 0),
              displayName:
                typeof obj.displayName === "string"
                  ? obj.displayName
                  : undefined,
              color: typeof obj.color === "string" ? obj.color : undefined,
            };
          })
          .filter((r) => Boolean(r.rarity));

        if (!active) return;
        setRarityConfigs(parsed);
      } catch (error) {
        if (!active) return;
        setRarityConfigsError(
          error instanceof Error
            ? error.message
            : "Failed to load rarity config",
        );
        setRarityConfigs([]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const previewRarities = useMemo<ItemRarity[]>(() => {
    const cfgs = rarityConfigs;
    if (!cfgs || cfgs.length === 0) return ITEM_RARITY_VALUES;

    const sorted = [...cfgs].sort((a, b) => a.sortOrder - b.sortOrder);
    const inOrder = sorted.map((c) => c.rarity);
    const remaining = ITEM_RARITY_VALUES.filter((r) => !inOrder.includes(r));
    return [...inOrder, ...remaining];
  }, [rarityConfigs]);

  const rarityIndex = useMemo(() => {
    const map = new Map<ItemRarity, number>();
    previewRarities.forEach((r, idx) => map.set(r, idx));
    return map;
  }, [previewRarities]);

  const previewMultipliers = useMemo(() => {
    const map = new Map<ItemRarity, number>();
    for (const r of previewRarities) map.set(r, 1);
    for (const c of rarityConfigs ?? []) {
      map.set(
        c.rarity,
        Number.isFinite(c.statMultiplier) ? c.statMultiplier : 1,
      );
    }
    return map;
  }, [rarityConfigs, previewRarities]);

  const rarityChoices = useMemo(
    () => rarityOptions(previewRarities, rarityConfigs),
    [previewRarities, rarityConfigs],
  );

  const previewRows = useMemo(
    () =>
      buildPreviewRows({
        baseStatsCsv: values.baseStatsCsv ?? "",
        toolEfficienciesCsv: values.toolEfficienciesCsv ?? "",
        statProgressionsCsv: values.statProgressionsCsv ?? "",
        statRarityOverridesCsv: values.statRarityOverridesCsv ?? "",
        minPhysicalDamage: values.minPhysicalDamage,
        maxPhysicalDamage: values.maxPhysicalDamage,
        minMagicDamage: values.minMagicDamage,
        maxMagicDamage: values.maxMagicDamage,
        armor: values.armor,
      }),
    [
      values.baseStatsCsv,
      values.toolEfficienciesCsv,
      values.statProgressionsCsv,
      values.statRarityOverridesCsv,
      values.minPhysicalDamage,
      values.maxPhysicalDamage,
      values.minMagicDamage,
      values.maxMagicDamage,
      values.armor,
    ],
  );

  const setOverride = (
    statType: StatType,
    rarity: ItemRarity,
    next: OverrideChange,
  ) => {
    const matches = (row: { statType: StatType; rarity: ItemRarity }) =>
      row.statType === statType && row.rarity === rarity;
    if (next === null) {
      overrides.setRows(overrides.rows.filter((row) => !matches(row)));
      return;
    }
    const row = { statType, rarity, kind: next.kind, value: next.value };
    const index = overrides.rows.findIndex(matches);
    // One override per stat and rarity: replace it in place, drop repeats.
    overrides.setRows(
      index === -1
        ? [...overrides.rows, row]
        : overrides.rows.flatMap((existing, i) =>
            i === index ? [row] : matches(existing) ? [] : [existing],
          ),
    );
  };

  const onSubmit = async (formValues: ItemFormValues) => {
    setIsSaving(true);
    let ok = false;
    try {
      const res = await fetch(
        isCreate ? "/api/admin/items" : `/api/admin/items/${props.itemId}`,
        {
          method: isCreate ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        },
      );

      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(errorMessage(json, "Failed to save"));
        return;
      }

      ok = true;
      setSaved(true);
      toast.success(`${formValues.name} ${isCreate ? "created" : "saved"}`);
      router.push("/admin/items");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      if (!ok) setIsSaving(false);
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<ItemFormValues>) => {
    const labels = [
      ...new Set(
        (Object.keys(fieldErrors) as Array<keyof ItemFormValues>).map(
          (name) => FIELD_PLACES[name]?.label ?? humanize(name),
        ),
      ),
    ];
    toast.error(`Check ${labels.join(", ")} before saving.`);
  };

  const submit = form.handleSubmit(onSubmit, onInvalid);
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // ⌘S / Ctrl+S saves, like the Save button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        if (!busyRef.current) void submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useLeaveGuard(dirty && !saved);
  useEffect(() => {
    props.unsavedRef.current = dirty && !saved;
  });

  const errorSections = new Set(
    (Object.keys(errors) as Array<keyof ItemFormValues>).map(
      (name) => FIELD_PLACES[name]?.section ?? "general",
    ),
  );
  if ([baseStats, tools, progressions].some((list) => list.error !== null)) {
    errorSections.add("stats");
  }
  if (bonuses.error) errorSections.add("consumable");
  if (overrides.error) errorSections.add("rarity");

  const sections = [
    { id: "general", label: "General" },
    ...(supportsTimedEffect ? [{ id: "consumable", label: "Consumable" }] : []),
    ...(isSeedItem ? [{ id: "seed", label: "Seed" }] : []),
    { id: "equipment", label: "Equipment" },
    { id: "stats", label: "Stats" },
    { id: "rarity", label: "Rarity" },
    ...(props.chain ? [{ id: "chain", label: "Crafting chain" }] : []),
  ];
  const activeSection = useActiveSection(sections.map((section) => section.id));

  // The bar shows the item's name once the header has scrolled away.
  const headerRef = useRef<HTMLElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPinned(entry ? !entry.isIntersecting : false),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${id}`);
  };

  const discard = () => {
    if (window.confirm("Discard your changes to this item?")) props.onDiscard();
  };

  const name =
    values.name.trim() !== ""
      ? values.name.trim()
      : isCreate
        ? "New item"
        : "Untitled item";
  const color = rarityColor(values.rarity, rarityConfigs);
  const sprite = values.sprite;
  const spriteMissing = sprite.trim() !== "" && brokenSprite === sprite.trim();
  const level = toNumber(values.requiredLevel);
  const price = toNumber(values.price);
  const stackSize = toNumber(values.maxStackSize);
  const facts = [
    values.itemType ? humanize(values.itemType) : "No type",
    slot
      ? `${slotLabel(slot)}${isWeapon && values.twoHanded ? ", two-handed" : ""}`
      : null,
    level !== null ? `Level ${level}` : null,
    price !== null ? `${price.toLocaleString("en-US")} gold` : null,
    values.stackable && stackSize !== null
      ? `Stacks to ${stackSize.toLocaleString("en-US")}`
      : null,
    props.itemId ? `#${props.itemId}` : null,
  ].filter(
    (fact, index, all): fact is string =>
      Boolean(fact) && all.indexOf(fact) === index,
  );

  const minPhysical = toNumber(values.minPhysicalDamage);
  const maxPhysical = toNumber(values.maxPhysicalDamage);
  const minMagic = toNumber(values.minMagicDamage);
  const maxMagic = toNumber(values.maxMagicDamage);
  const yieldMin = toNumber(values.seedYieldMin);
  const yieldMax = toNumber(values.seedYieldMax);
  const seedGaps = isSeedItem
    ? [
        !(toNumber(values.seedGrowSeconds) ?? 0) ? "grow time" : null,
        !values.seedYieldItemId ? "what it grows into" : null,
        !(yieldMin && yieldMin > 0) || yieldMax === null || yieldMax < yieldMin
          ? "a harvest amount (max at least min)"
          : null,
        !(toNumber(values.seedHarvestSeconds) ?? 0) ? "harvest time" : null,
      ].filter((gap): gap is string => Boolean(gap))
    : [];

  const statTypesUsedBy = (
    rows: Array<{ statType: StatType }>,
    except: number,
  ) => new Set(rows.filter((_, i) => i !== except).map((row) => row.statType));

  return (
    <>
      <header ref={headerRef} className="flex items-center gap-4">
        <SpriteTile
          sprite={sprite}
          color={color}
          size={64}
          onMissing={setBrokenSprite}
        />
        <div className="w-0 flex-1">
          <Link
            href="/admin/items"
            className="inline-flex items-center gap-0.5 text-xs text-white/45 transition-colors hover:text-white"
          >
            <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
            Items
          </Link>
          <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/50">
            <RarityChip
              rarity={values.rarity}
              color={
                rarityConfigs?.find((c) => c.rarity === values.rarity)?.color
              }
              label={rarityLabel(values.rarity, rarityConfigs)}
            />
            {facts.map((fact) => (
              <span key={fact} className="flex items-center gap-2">
                <span aria-hidden className="text-white/20">
                  ·
                </span>
                {fact}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div
        className={cn(
          "sticky top-0 z-30 -mx-3 px-3 py-2 transition-[background-color,box-shadow] duration-200",
          pinned &&
            "bg-background/85 shadow-[0_14px_24px_-20px_rgb(0_0_0/0.9)] backdrop-blur-md",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            aria-hidden={!pinned}
            className={cn(
              "hidden min-w-0 items-center gap-2 overflow-hidden transition-all duration-200 lg:flex",
              pinned
                ? "max-w-[220px] opacity-100"
                : "pointer-events-none max-w-0 opacity-0",
            )}
          >
            <SpriteTile
              sprite={sprite}
              color={color}
              size={28}
              className="rounded-md"
            />
            <span className="truncate text-sm font-semibold">{name}</span>
          </div>
          <nav
            aria-label="Sections"
            className="flex w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(event) => jumpTo(event, section.id)}
                aria-current={
                  activeSection === section.id ? "location" : undefined
                }
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/40",
                  activeSection === section.id
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white",
                )}
              >
                {section.label}
                {errorSections.has(section.id) ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-red-400"
                    title="Needs attention"
                  />
                ) : null}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <span
              aria-live="polite"
              className="hidden items-center gap-1.5 text-xs sm:flex"
            >
              {dirty && !saved ? (
                <>
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-amber-400"
                  />
                  <span className="text-amber-200/90">Unsaved changes</span>
                </>
              ) : (
                <span className="text-white/35">
                  {isCreate
                    ? "Not created yet"
                    : saved
                      ? "Saved"
                      : "No changes"}
                </span>
              )}
            </span>
            {dirty && !busy ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-white/70"
                onClick={discard}
              >
                <Undo2 aria-hidden className="h-3.5 w-3.5" />
                Discard
              </Button>
            ) : null}
            <Button
              type="submit"
              form={FORM_ID}
              size="sm"
              className="h-8 px-3.5"
              disabled={busy}
              title="Save (⌘S or Ctrl+S)"
            >
              {isSaving ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save aria-hidden className="h-3.5 w-3.5" />
              )}
              {isSaving ? "Saving…" : isCreate ? "Create item" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-5">
        <input type="hidden" {...form.register("baseStatsCsv")} />
        <input type="hidden" {...form.register("toolEfficienciesCsv")} />
        <input type="hidden" {...form.register("statProgressionsCsv")} />
        <input type="hidden" {...form.register("statRarityOverridesCsv")} />
        <input type="hidden" {...form.register("foodEffectStatsCsv")} />

        <FormSection id="general" icon={Tag} title="General">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field
              label="Name"
              htmlFor="item-name"
              error={errors.name?.message}
              className="sm:col-span-2"
            >
              <input
                id="item-name"
                autoFocus={isCreate}
                autoComplete="off"
                className={cn(controlClass, errors.name && invalidClass)}
                {...form.register("name")}
              />
            </Field>
            <Field label="Type" htmlFor="item-type">
              <ChoicePicker
                id="item-type"
                value={values.itemType ?? null}
                options={ITEM_TYPE_OPTIONS}
                noneLabel="No type"
                onChange={(value) => form.setValue("itemType", value, DIRTY)}
              />
            </Field>
            <Field
              label="Rarity"
              htmlFor="item-rarity"
              hint="New copies start at this rarity."
            >
              <ChoicePicker
                id="item-rarity"
                value={values.rarity}
                options={rarityChoices}
                onChange={(value) => {
                  if (value) form.setValue("rarity", value, DIRTY);
                }}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="item-description"
              className="sm:col-span-2 xl:col-span-4"
            >
              <textarea
                id="item-description"
                rows={2}
                placeholder="What players read about it"
                className={cn(
                  controlClass,
                  "h-auto max-h-72 min-h-[60px] resize-none overflow-y-auto py-2 leading-relaxed",
                )}
                {...descriptionField}
                ref={(element) => {
                  descriptionField.ref(element);
                  fitToContent(element);
                }}
                onInput={(event) => fitToContent(event.currentTarget)}
              />
            </Field>
            <Field
              label="Sprite"
              htmlFor="item-sprite"
              error={errors.sprite?.message}
              hint={
                spriteMissing ? (
                  <span className="text-amber-200/80">
                    No image found at this path.
                  </span>
                ) : (
                  "Path of the image under /public."
                )
              }
              className="sm:col-span-2"
            >
              <input
                id="item-sprite"
                autoComplete="off"
                spellCheck={false}
                placeholder="/assets/items/…"
                className={cn(
                  controlClass,
                  "font-mono text-[13px]",
                  errors.sprite && invalidClass,
                )}
                {...form.register("sprite")}
              />
            </Field>
            <Field
              label="Required level"
              htmlFor="item-level"
              error={errors.requiredLevel?.message}
            >
              <input
                id="item-level"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                className={cn(
                  controlClass,
                  numberClass,
                  errors.requiredLevel && invalidClass,
                )}
                {...form.register("requiredLevel")}
              />
            </Field>
            <Field
              label="Price"
              htmlFor="item-price"
              error={errors.price?.message}
            >
              <WithSuffix suffix="gold">
                <input
                  id="item-price"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  className={cn(
                    controlClass,
                    numberClass,
                    "pr-12",
                    errors.price && invalidClass,
                  )}
                  {...form.register("price")}
                />
              </WithSuffix>
            </Field>
          </div>
          <div className="mt-4 flex min-h-[52px] flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-white/[0.03] px-3 py-2">
            <Switch
              checked={Boolean(values.stackable)}
              onChange={(checked) => form.setValue("stackable", checked, DIRTY)}
              label="Stackable"
              description="Copies share one inventory slot."
            />
            {values.stackable ? (
              <label className="flex items-center gap-2 text-sm text-white/55">
                Up to
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  aria-label="Max stack size"
                  className={cn(
                    controlClass,
                    numberClass,
                    "h-8 w-24",
                    errors.maxStackSize && invalidClass,
                  )}
                  {...form.register("maxStackSize")}
                />
                per slot
              </label>
            ) : null}
            {errors.maxStackSize ? (
              <p role="alert" className="text-[11px] text-red-300">
                {errors.maxStackSize.message}
              </p>
            ) : null}
          </div>
        </FormSection>

        {supportsTimedEffect ? (
          <FormSection
            id="consumable"
            icon={FlaskConical}
            title="Consumable"
            description="What using it does."
          >
            <div className="grid gap-6 xl:grid-cols-2 xl:gap-x-10">
              <div className="grid content-start gap-4 sm:grid-cols-2">
                <Field
                  label="Instant healing"
                  htmlFor="item-healing"
                  error={errors.healingAmount?.message}
                  hint="Health restored right away."
                >
                  <WithSuffix suffix="HP">
                    <input
                      id="item-healing"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className={cn(
                        controlClass,
                        numberClass,
                        "pr-10",
                        errors.healingAmount && invalidClass,
                      )}
                      {...form.register("healingAmount")}
                    />
                  </WithSuffix>
                </Field>
                <Field
                  label="Effect duration"
                  htmlFor="item-duration"
                  error={errors.foodEffectSeconds?.message}
                  hint={durationHint(
                    values.foodEffectSeconds,
                    "How long the bonuses last.",
                  )}
                >
                  <WithSuffix suffix="sec">
                    <input
                      id="item-duration"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className={cn(
                        controlClass,
                        numberClass,
                        "pr-11",
                        errors.foodEffectSeconds && invalidClass,
                      )}
                      {...form.register("foodEffectSeconds")}
                    />
                  </WithSuffix>
                </Field>
              </div>
              <ListEditor
                title="Timed bonuses"
                description="Last for the effect duration. Using another timed consumable replaces them."
                columns={BONUS_COLUMNS}
                headers={["Stat", "Bonus", ""]}
                count={bonuses.rows.length}
                addLabel="Add bonus"
                addDisabled={bonuses.rows.length >= ALL_STAT_TYPES.length}
                onAdd={() => {
                  const used = new Set(bonuses.rows.map((row) => row.statType));
                  const statType = ALL_STAT_OPTIONS.find(
                    (option) => !used.has(option.value),
                  )?.value;
                  if (statType) bonuses.add({ statType, value: 0 });
                }}
                empty="No timed bonuses. Add one"
                raw={bonuses.raw}
                onToggleRaw={bonuses.toggleRaw}
                error={bonuses.error}
                rawEditor={
                  <CsvEditor
                    format={foodEffectStatsCodec.format}
                    example={foodEffectStatsCodec.example}
                    textarea={form.register("foodEffectStatsCsv")}
                    onApply={bonuses.toggleRaw}
                  />
                }
              >
                {bonuses.rows.map((row, index) => {
                  const taken = statTypesUsedBy(bonuses.rows, index);
                  return (
                    <ListRow
                      key={index}
                      columns={BONUS_COLUMNS}
                      removeLabel={`Remove ${statLabel(row.statType)}`}
                      onRemove={() => bonuses.remove(index)}
                    >
                      <ChoicePicker
                        compact
                        ariaLabel="Stat"
                        value={row.statType}
                        options={ALL_STAT_OPTIONS.filter(
                          (option) => !taken.has(option.value),
                        )}
                        onChange={(value) => {
                          if (value) bonuses.update(index, { statType: value });
                        }}
                      />
                      <StatValueInput
                        percent={isPercentStat(row.statType)}
                        label="Bonus"
                        value={row.value}
                        onChange={(value) => bonuses.update(index, { value })}
                      />
                    </ListRow>
                  );
                })}
              </ListEditor>
            </div>
          </FormSection>
        ) : null}

        {isSeedItem ? (
          <FormSection
            id="seed"
            icon={Sprout}
            title="Seed"
            description="How it grows in a garden plot."
          >
            {seedGaps.length > 0 ? (
              <div className="mb-4">
                <ErrorNote tone="warning">
                  Players can&apos;t plant it until it has {seedGaps.join(", ")}
                  .
                </ErrorNote>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Grows into"
                hint={seedYieldOptions === null ? "Loading items…" : undefined}
                className="sm:col-span-2"
              >
                <SearchSelect
                  options={seedYieldOptions ?? []}
                  value={values.seedYieldItemId ?? null}
                  onChange={(id) => form.setValue("seedYieldItemId", id, DIRTY)}
                  noneLabel="Nothing yet"
                  className="h-9 rounded-lg border-0 bg-white/[0.06] px-3 shadow-none hover:bg-white/[0.08]"
                />
              </Field>
              <Field
                label="Harvest amount"
                htmlFor="seed-yield-min"
                error={
                  errors.seedYieldMin?.message ?? errors.seedYieldMax?.message
                }
                hint="Items per plot, from min to max."
                className="sm:col-span-2"
              >
                <div className="flex items-center gap-1.5">
                  <input
                    id="seed-yield-min"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="Min"
                    aria-label="Harvest amount minimum"
                    className={cn(controlClass, numberClass)}
                    {...form.register("seedYieldMin")}
                  />
                  <span aria-hidden className="text-white/30">
                    –
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="Max"
                    aria-label="Harvest amount maximum"
                    className={cn(controlClass, numberClass)}
                    {...form.register("seedYieldMax")}
                  />
                </div>
              </Field>
              <Field
                label="Grow time"
                htmlFor="seed-grow"
                error={errors.seedGrowSeconds?.message}
                hint={durationHint(
                  values.seedGrowSeconds,
                  "From planting until ready.",
                )}
              >
                <WithSuffix suffix="sec">
                  <input
                    id="seed-grow"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className={cn(
                      controlClass,
                      numberClass,
                      "pr-11",
                      errors.seedGrowSeconds && invalidClass,
                    )}
                    {...form.register("seedGrowSeconds")}
                  />
                </WithSuffix>
              </Field>
              <Field
                label="Harvest time"
                htmlFor="seed-harvest"
                error={errors.seedHarvestSeconds?.message}
                hint={durationHint(
                  values.seedHarvestSeconds,
                  "To harvest one plot.",
                )}
              >
                <WithSuffix suffix="sec">
                  <input
                    id="seed-harvest"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className={cn(
                      controlClass,
                      numberClass,
                      "pr-11",
                      errors.seedHarvestSeconds && invalidClass,
                    )}
                    {...form.register("seedHarvestSeconds")}
                  />
                </WithSuffix>
              </Field>
              <Field
                label="Gardening XP"
                htmlFor="seed-xp"
                error={errors.seedXp?.message}
                hint="Per plot harvested."
              >
                <input
                  id="seed-xp"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  className={cn(
                    controlClass,
                    numberClass,
                    errors.seedXp && invalidClass,
                  )}
                  {...form.register("seedXp")}
                />
              </Field>
            </div>
          </FormSection>
        ) : null}

        <FormSection id="equipment" icon={Swords} title="Equipment">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field
              label="Slot"
              htmlFor="item-slot"
              hint={
                slot === "weapon" || slot === "offhand"
                  ? "Shields go in the off hand; one-handed weapons fit either hand."
                  : undefined
              }
              className="xl:col-span-2"
            >
              <ChoicePicker
                id="item-slot"
                value={slot}
                options={SLOT_OPTIONS}
                noneLabel="Not equippable"
                onChange={(value) => form.setValue("equipTo", value, DIRTY)}
              />
            </Field>
            {isWeapon ? (
              <Field
                label="Handedness"
                hint={
                  values.twoHanded
                    ? "Takes the main hand and keeps the off hand empty."
                    : "Fits the main hand or the off hand."
                }
                className="xl:col-span-2"
              >
                <Segmented
                  label="Handedness"
                  value={values.twoHanded ? "two" : "one"}
                  options={[
                    { value: "one", label: "One-handed" },
                    { value: "two", label: "Two-handed" },
                  ]}
                  onChange={(value) =>
                    form.setValue("twoHanded", value === "two", DIRTY)
                  }
                  className="bg-white/[0.06] p-0.5"
                />
              </Field>
            ) : null}
          </div>
          {showCombat ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  [
                    "Physical damage",
                    "minPhysicalDamage",
                    "maxPhysicalDamage",
                    minPhysical,
                    maxPhysical,
                  ],
                  [
                    "Magic damage",
                    "minMagicDamage",
                    "maxMagicDamage",
                    minMagic,
                    maxMagic,
                  ],
                ] as const
              ).map(([label, minName, maxName, min, max]) => (
                <Field
                  key={label}
                  label={label}
                  htmlFor={`item-${minName}`}
                  error={errors[minName]?.message ?? errors[maxName]?.message}
                  hint={
                    min !== null && max !== null && min > max ? (
                      <span className="text-amber-200/80">
                        The minimum is above the maximum.
                      </span>
                    ) : undefined
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      id={`item-${minName}`}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="Min"
                      aria-label={`${label} minimum`}
                      className={cn(controlClass, numberClass)}
                      {...form.register(minName)}
                    />
                    <span aria-hidden className="text-white/30">
                      –
                    </span>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="Max"
                      aria-label={`${label} maximum`}
                      className={cn(controlClass, numberClass)}
                      {...form.register(maxName)}
                    />
                  </div>
                </Field>
              ))}
              <Field
                label="Armor"
                htmlFor="item-armor"
                error={errors.armor?.message}
              >
                <input
                  id="item-armor"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  className={cn(controlClass, numberClass)}
                  {...form.register("armor")}
                />
              </Field>
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/40">
              Damage and armor apply to equipped items. Pick a slot to set them.
            </p>
          )}
        </FormSection>

        <FormSection
          id="stats"
          icon={BarChart3}
          title="Stats"
          description="Values are for Common; the rarity grid below shows what every rarity gets."
        >
          <div className="grid gap-7 xl:grid-cols-2 xl:gap-x-10">
            <ListEditor
              title="Base stats"
              description="Always on, then scaled by rarity. Damage and armor are set under Equipment."
              columns={BASE_COLUMNS}
              headers={["Stat", "Value", "Cap", ""]}
              count={baseStats.rows.length}
              addLabel="Add stat"
              onAdd={() => {
                const used = new Set(baseStats.rows.map((row) => row.statType));
                const statType = !used.has(StatType.CARRYING_CAPACITY)
                  ? StatType.CARRYING_CAPACITY
                  : BASE_STAT_OPTIONS.find((option) => !used.has(option.value))
                      ?.value ?? StatType.CARRYING_CAPACITY;
                baseStats.add({ statType, value: 0, maxValue: null });
              }}
              empty="No base stats. Add one"
              raw={baseStats.raw}
              onToggleRaw={baseStats.toggleRaw}
              error={baseStats.error}
              rawEditor={
                <CsvEditor
                  format={baseStatsCodec.format}
                  example={baseStatsCodec.example}
                  textarea={form.register("baseStatsCsv")}
                  onApply={baseStats.toggleRaw}
                />
              }
            >
              {baseStats.rows.map((row, index) => (
                <ListRow
                  key={index}
                  columns={BASE_COLUMNS}
                  removeLabel={`Remove ${statLabel(row.statType)}`}
                  onRemove={() => baseStats.remove(index)}
                >
                  <ChoicePicker
                    compact
                    ariaLabel="Stat"
                    value={row.statType}
                    options={BASE_STAT_OPTIONS}
                    onChange={(value) => {
                      if (value) baseStats.update(index, { statType: value });
                    }}
                  />
                  <StatValueInput
                    percent={isPercentStat(row.statType)}
                    label="Value"
                    value={row.value}
                    onChange={(value) => baseStats.update(index, { value })}
                  />
                  <NumberInput
                    step="0.01"
                    aria-label="Cap"
                    placeholder="No cap"
                    className={cn(controlClass, numberClass, "h-8")}
                    value={row.maxValue ?? null}
                    onValueChange={(value) =>
                      baseStats.update(index, { maxValue: value })
                    }
                  />
                </ListRow>
              ))}
            </ListEditor>
            <div className="space-y-7">
              <ListEditor
                title="Unlocks by rarity"
                description="Stats gained from a rarity upward, added to any base value."
                columns={UNLOCK_COLUMNS}
                headers={["Stat", "Value", "From", ""]}
                count={progressions.rows.length}
                addLabel="Add unlock"
                onAdd={() =>
                  progressions.add({
                    statType: ALL_STAT_OPTIONS[0]!.value,
                    baseValue: 0,
                    unlocksAtRarity: ItemRarity.COMMON,
                  })
                }
                empty="No rarity unlocks. Add one"
                raw={progressions.raw}
                onToggleRaw={progressions.toggleRaw}
                error={progressions.error}
                rawEditor={
                  <CsvEditor
                    format={statProgressionsCodec.format}
                    example={statProgressionsCodec.example}
                    textarea={form.register("statProgressionsCsv")}
                    onApply={progressions.toggleRaw}
                  />
                }
              >
                {progressions.rows.map((row, index) => (
                  <ListRow
                    key={index}
                    columns={UNLOCK_COLUMNS}
                    removeLabel={`Remove ${statLabel(row.statType)}`}
                    onRemove={() => progressions.remove(index)}
                  >
                    <ChoicePicker
                      compact
                      ariaLabel="Stat"
                      value={row.statType}
                      options={ALL_STAT_OPTIONS}
                      onChange={(value) => {
                        if (value)
                          progressions.update(index, { statType: value });
                      }}
                    />
                    <StatValueInput
                      percent={isPercentStat(row.statType)}
                      label="Value"
                      value={row.baseValue}
                      onChange={(value) =>
                        progressions.update(index, { baseValue: value })
                      }
                    />
                    <ChoicePicker
                      compact
                      ariaLabel="Unlocks at rarity"
                      value={row.unlocksAtRarity}
                      options={rarityChoices}
                      onChange={(value) => {
                        if (value)
                          progressions.update(index, {
                            unlocksAtRarity: value,
                          });
                      }}
                    />
                  </ListRow>
                ))}
              </ListEditor>

              <ListEditor
                title="Tool efficiency"
                description="Faster skilling while equipped, in percent. Scales with rarity."
                columns={TOOL_COLUMNS}
                headers={["Skill", "Bonus", ""]}
                count={tools.rows.length}
                addLabel="Add skill"
                onAdd={() => {
                  const used = new Set(tools.rows.map((row) => row.actionType));
                  tools.add({
                    actionType:
                      SKILL_OPTIONS.find((option) => !used.has(option.value))
                        ?.value ?? ALL_ACTION_TYPES[0]!,
                    baseEfficiency: 0,
                  });
                }}
                empty="No tool efficiency. Add a skill"
                raw={tools.raw}
                onToggleRaw={tools.toggleRaw}
                error={tools.error}
                rawEditor={
                  <CsvEditor
                    format={toolEfficienciesCodec.format}
                    example={toolEfficienciesCodec.example}
                    textarea={form.register("toolEfficienciesCsv")}
                    onApply={tools.toggleRaw}
                  />
                }
              >
                {tools.rows.map((row, index) => (
                  <ListRow
                    key={index}
                    columns={TOOL_COLUMNS}
                    removeLabel={`Remove ${humanize(row.actionType)}`}
                    onRemove={() => tools.remove(index)}
                  >
                    <ChoicePicker
                      compact
                      ariaLabel="Skill"
                      value={row.actionType}
                      options={SKILL_OPTIONS}
                      onChange={(value) => {
                        if (value) tools.update(index, { actionType: value });
                      }}
                    />
                    <StatValueInput
                      percent
                      label="Bonus"
                      value={row.baseEfficiency}
                      min={0}
                      max={100}
                      onChange={(value) =>
                        tools.update(index, {
                          baseEfficiency: clampPercent(value),
                        })
                      }
                    />
                  </ListRow>
                ))}
              </ListEditor>
            </div>
          </div>
        </FormSection>

        <FormSection
          id="rarity"
          icon={Gem}
          title="Rarity scaling"
          description={
            rarityConfigs === null
              ? "Loading the rarity multipliers…"
              : "What each rarity gets. Click a value to set it for this item only."
          }
          actions={
            <CsvToggle
              raw={overrides.raw}
              onToggle={overrides.toggleRaw}
              title={
                overrides.raw ? "Back to the grid" : "Edit the overrides as CSV"
              }
            />
          }
        >
          <div className="space-y-4">
            {rarityConfigsError ? (
              <ErrorNote>{rarityConfigsError}</ErrorNote>
            ) : null}
            {overrides.error ? <ErrorNote>{overrides.error}</ErrorNote> : null}
            <RarityScalingGrid
              rows={previewRows}
              rarities={previewRarities}
              configs={rarityConfigs}
              multipliers={previewMultipliers}
              rarityIndex={rarityIndex}
              equipTo={slot}
              flipNegatives={Boolean(values.flipNegativeStatsWithRarity)}
              itemRarity={values.rarity}
              onOverride={overrides.raw ? null : setOverride}
            />
            {overrides.raw ? (
              <CsvEditor
                format={statRarityOverridesCodec.format}
                example={statRarityOverridesCodec.example}
                textarea={form.register("statRarityOverridesCsv")}
                onApply={overrides.toggleRaw}
              />
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <Switch
                checked={Boolean(values.flipNegativeStatsWithRarity)}
                onChange={(checked) =>
                  form.setValue("flipNegativeStatsWithRarity", checked, DIRTY)
                }
                label="Negative stats improve with rarity"
                description="A −5 Movement speed at Common can turn positive at high rarities."
              />
              {previewRows.length > 0 ? (
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/40">
                  <li className="flex items-center gap-1.5">
                    <span className="rounded bg-amber-400/[0.14] px-1 font-semibold text-amber-300/80">
                      =
                    </span>
                    Exact value
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="rounded bg-amber-400/[0.14] px-1 font-semibold text-amber-300/80">
                      ×
                    </span>
                    Own multiplier
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-sm bg-white/[0.08]"
                    />
                    This item&apos;s rarity
                  </li>
                  <li>
                    <Link
                      href="/admin/rarity"
                      className="text-white/55 underline-offset-2 transition-colors hover:text-white hover:underline"
                    >
                      Global multipliers
                    </Link>
                  </li>
                </ul>
              ) : null}
            </div>
          </div>
        </FormSection>
      </form>
    </>
  );
}

/** A stat value in a list row, with a % when the stat is a percentage. */
function StatValueInput(props: {
  percent: boolean;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const input = (
    <NumberInput
      step="0.01"
      min={props.min}
      max={props.max}
      aria-label={props.label}
      className={cn(controlClass, numberClass, "h-8", props.percent && "pr-7")}
      value={props.value}
      // An emptied field keeps its value until something is typed.
      onValueChange={(value) => {
        if (value !== null) props.onChange(value);
      }}
    />
  );
  return props.percent ? <WithSuffix suffix="%">{input}</WithSuffix> : input;
}

function DeleteItemSection(props: { itemId: number; name: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const onDelete = async () => {
    if (
      !window.confirm(
        `Delete ${props.name}?\n\nEvery copy players own is deleted with it. This can't be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/items/${props.itemId}`, {
        method: "DELETE",
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(errorMessage(json, "Failed to delete"));
        return;
      }
      toast.success(`${props.name} deleted`);
      router.push("/admin/items");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <FormSection
      id="delete"
      icon={Trash2}
      tone="danger"
      title="Delete item"
      description="Removes it for good, with every copy players own and any recipe that makes it. It can't be deleted while something still uses it: an ingredient, drop, shop offer, quest, garden plot, settlement project or market history."
      actions={
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isDeleting}
          onClick={onDelete}
        >
          {isDeleting ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
          )}
          {isDeleting ? "Deleting…" : "Delete item"}
        </Button>
      }
    />
  );
}
