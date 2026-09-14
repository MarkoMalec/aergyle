"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { Pencil, Check, X, ChevronsUpDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

type SeedRow = {
  id: number;
  name: string;
  sprite: string;
  seedGrowSeconds: number | null;
  seedHarvestSeconds: number | null;
  seedYieldMin: number | null;
  seedYieldMax: number | null;
  seedYieldItemId?: number | null;
  seedYieldItem: null | { id: number; name: string; sprite: string };
};

type YieldOption = { id: number; name: string; sprite: string };

function formatSeconds(value: number | null) {
  if (value == null) return "—";
  return `${value}s`;
}

function EditableNumberCell(props: {
  itemId: number;
  field: "seedGrowSeconds" | "seedHarvestSeconds" | "seedYieldMin" | "seedYieldMax";
  value: number | null;
  display?: (value: number | null) => string;
  onUpdated: (next: number | null) => void;
}) {
  const display = props.display ?? ((v) => (v == null ? "—" : String(v)));

  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(props.value == null ? "" : String(props.value));
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isEditing) return;
    setDraft(props.value == null ? "" : String(props.value));
  }, [props.value, isEditing]);

  const cancel = () => {
    setIsEditing(false);
    setDraft(props.value == null ? "" : String(props.value));
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const nextValue = draft.trim().length === 0 ? null : Number(draft);
      const res = await fetch(`/api/admin/gathering/seeds/${props.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [props.field]: nextValue }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");

      props.onUpdated(nextValue);
      setIsEditing(false);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    const secondsAsNumber = Number(draft);
    const showMinutesHint =
      props.field === "seedGrowSeconds" && Number.isFinite(secondsAsNumber);
    const minutes = secondsAsNumber / 60;
    const hours = minutes / 60;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-24"
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancel();
            }}
            disabled={isSaving}
          />
          <Button type="button" variant="ghost" size="icon" onClick={save} disabled={isSaving}>
            <Check className="h-4 w-4" />
            <span className="sr-only">Save</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={cancel} disabled={isSaving}>
            <X className="h-4 w-4" />
            <span className="sr-only">Cancel</span>
          </Button>
        </div>

        {showMinutesHint ? (
          <div className="text-xs text-white/60">
            {minutes.toFixed(2)} min
            {hours >= 1 ? ` • ${hours.toFixed(2)} h` : ""}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-white/80">
      <span>{display(props.value)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Edit</span>
      </Button>
    </div>
  );
}

function EditableYieldItemCell(props: {
  seedId: number;
  value: SeedRow["seedYieldItem"];
  valueId?: number | null;
  options: YieldOption[] | null;
  onUpdated: (next: SeedRow["seedYieldItem"], nextId: number | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const selectedId =
    typeof props.value?.id === "number"
      ? props.value.id
      : typeof props.valueId === "number"
        ? props.valueId
        : null;

  const selected =
    selectedId == null
      ? null
      : props.options?.find((o) => o.id === selectedId) ??
        (props.value && props.value.id === selectedId
          ? { id: props.value.id, name: props.value.name, sprite: props.value.sprite }
          : null);

  const onSelect = async (nextId: number | null) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/gathering/seeds/${props.seedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedYieldItemId: nextId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");

      const nextObj =
        nextId == null
          ? null
          : (props.options ?? []).find((o) => o.id === nextId) ?? null;

      props.onUpdated(
        nextObj
          ? { id: nextObj.id, name: nextObj.name, sprite: nextObj.sprite }
          : null,
        nextId,
      );
      toast.success("Saved");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[260px] justify-between"
          disabled={props.options === null || isSaving}
        >
          <span className="flex min-w-0 items-center gap-2">
            {props.options === null ? (
              <span className="truncate">Loading…</span>
            ) : selected ? (
              <>
                <Image
                  src={selected.sprite}
                  alt=""
                  width={18}
                  height={18}
                  className="h-4.5 w-4.5 object-contain"
                />
                <span className="truncate">{selected.name}</span>
                <span className="shrink-0 text-white/50">#{selected.id}</span>
              </>
            ) : (
              <span className="truncate">Select yield item…</span>
            )}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0">
        <Command>
          <CommandInput placeholder="Search item…" className="h-9" />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none"
                onSelect={() => {
                  void onSelect(null);
                }}
              >
                None
                <Check
                  className={cn(
                    "ml-auto",
                    selectedId == null ? "opacity-100" : "opacity-0",
                  )}
                />
              </CommandItem>

              {(props.options ?? []).map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.name} #${opt.id}`}
                  onSelect={() => {
                    void onSelect(opt.id);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Image
                      src={opt.sprite}
                      alt=""
                      width={18}
                      height={18}
                      className="h-4.5 w-4.5 object-contain"
                    />
                    <span className="truncate">{opt.name}</span>
                    <span className="text-white/40">#{opt.id}</span>
                  </span>
                  <Check
                    className={cn(
                      "ml-auto",
                      selectedId === opt.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function GatheringSeedsTableClient(props: { initialSeeds: SeedRow[] }) {
  const [seeds, setSeeds] = React.useState<SeedRow[]>(props.initialSeeds);
  const [yieldOptions, setYieldOptions] = React.useState<YieldOption[] | null>(
    null,
  );

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/items", { method: "GET" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load items");

        const rows = Array.isArray(json) ? (json as unknown[]) : [];
        const parsed = rows
          .map((r) => {
            const o = r as { id?: unknown; name?: unknown; sprite?: unknown };
            return {
              id: Number(o.id),
              name: typeof o.name === "string" ? o.name : "",
              sprite: typeof o.sprite === "string" ? o.sprite : "",
            };
          })
          .filter(
            (r) =>
              Number.isFinite(r.id) &&
              r.id > 0 &&
              r.name.length > 0 &&
              r.sprite.length > 0,
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!active) return;
        setYieldOptions(parsed);
      } catch {
        if (!active) return;
        setYieldOptions([]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateSeedField = React.useCallback(
    (
      id: number,
      field: "seedGrowSeconds" | "seedHarvestSeconds" | "seedYieldMin" | "seedYieldMax",
      value: number | null,
    ) => {
      setSeeds((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
      );
    },
    [],
  );

  const updateSeedYieldItem = React.useCallback(
    (id: number, next: SeedRow["seedYieldItem"], nextId: number | null) => {
      setSeeds((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, seedYieldItem: next, seedYieldItemId: nextId } : s,
        ),
      );
    },
    [],
  );

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-white/70">
          <tr className="border-b border-white/10">
            <th className="px-3 py-2">Seed</th>
            <th className="px-3 py-2">Grow time (seconds)</th>
            <th className="px-3 py-2">Harvest time (seconds)</th>
            <th className="px-3 py-2">Yield item</th>
            <th className="px-3 py-2">Yield min</th>
            <th className="px-3 py-2">Yield max</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {seeds.map((s) => {
            const invalidRange =
              typeof s.seedYieldMin === "number" &&
              typeof s.seedYieldMax === "number" &&
              s.seedYieldMax < s.seedYieldMin;

            const missing =
              !s.seedGrowSeconds ||
              !s.seedHarvestSeconds ||
              !s.seedYieldItem ||
              !s.seedYieldMin ||
              !s.seedYieldMax ||
              invalidRange;

            return (
              <tr key={s.id} className="border-b border-white/5">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/items/${s.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Image
                      src={s.sprite}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain"
                    />
                    <span className="font-medium text-white/90">{s.name}</span>
                    <span className="text-white/50">#{s.id}</span>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell
                    itemId={s.id}
                    field="seedGrowSeconds"
                    value={s.seedGrowSeconds}
                    display={formatSeconds}
                    onUpdated={(v) => updateSeedField(s.id, "seedGrowSeconds", v)}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell
                    itemId={s.id}
                    field="seedHarvestSeconds"
                    value={s.seedHarvestSeconds}
                    display={formatSeconds}
                    onUpdated={(v) => updateSeedField(s.id, "seedHarvestSeconds", v)}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableYieldItemCell
                    seedId={s.id}
                    value={s.seedYieldItem}
                    valueId={s.seedYieldItemId ?? (s.seedYieldItem?.id ?? null)}
                    options={yieldOptions}
                    onUpdated={(next, nextId) =>
                      updateSeedYieldItem(s.id, next, nextId)
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell
                    itemId={s.id}
                    field="seedYieldMin"
                    value={s.seedYieldMin}
                    onUpdated={(v) => updateSeedField(s.id, "seedYieldMin", v)}
                  />
                </td>
                <td className="px-3 py-2">
                  <EditableNumberCell
                    itemId={s.id}
                    field="seedYieldMax"
                    value={s.seedYieldMax}
                    onUpdated={(v) => updateSeedField(s.id, "seedYieldMax", v)}
                  />
                </td>
                <td className="px-3 py-2">
                  {missing ? (
                    <span className="text-sm text-red-400">Needs config</span>
                  ) : (
                    <span className="text-sm text-green-400">OK</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-2 text-xs text-white/60">
        Times are in seconds. Leave a field blank to clear it.
      </div>
    </div>
  );
}
