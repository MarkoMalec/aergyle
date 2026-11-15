"use client";

/**
 * Building blocks for the list-and-detail admin editors (gathering, hunting,
 * creatures): compact inputs, a searchable side list, URL-backed tabs, and a
 * draft that collects every edit on the page behind one sticky Save bar.
 */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Save, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { adminRequest, NumberInput } from "~/components/admin/fields";
import { useLeaveGuard } from "~/components/admin/leaveGuard";
import { cn } from "~/lib/utils";

export const editorInput =
  "h-8 w-full rounded-[8px] bg-white/[0.06] px-2 text-sm tabular-nums text-white outline-none transition placeholder:text-white/30 focus:bg-white/[0.1] focus:ring-1 focus:ring-amber-400/50 disabled:opacity-40";
export const cardClass = "rounded-xl bg-gray-950/45 p-4";
/** Side list on the left, the selected entry on the right. */
export const masterDetailClass =
  "grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]";
export const theadClass =
  "whitespace-nowrap text-left text-[11px] uppercase tracking-wide text-white/40 [&_th]:px-2 [&_th]:py-2 [&_th]:font-medium";
export const rowClass = "odd:bg-white/[0.02] [&>td]:px-2 [&>td]:py-1.5";

export const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** A compact number box; an emptied field keeps the last valid value. */
export function Num(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Rounds to a whole number. */
  integer?: boolean;
  className?: string;
}) {
  const clamp = (value: number) => {
    const rounded = props.integer ? Math.round(value) : value;
    return Math.min(
      props.max ?? Infinity,
      Math.max(props.min ?? -Infinity, rounded),
    );
  };
  return (
    <span className={cn("relative block", props.className)}>
      <NumberInput
        aria-label={props.label}
        title={props.label}
        className={cn(
          editorInput,
          props.suffix && "pr-6",
          props.invalid && "bg-red-500/20 ring-1 ring-red-400/60",
        )}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        disabled={props.disabled}
        onValueChange={(value) => {
          if (value !== null) props.onChange(clamp(value));
        }}
      />
      {props.suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-white/40">
          {props.suffix}
        </span>
      ) : null}
    </span>
  );
}

/** A 0–1 fraction edited as a percentage. */
export function Percent(
  props: Omit<React.ComponentProps<typeof Num>, "suffix" | "min" | "max">,
) {
  return (
    <Num
      {...props}
      value={Number((props.value * 100).toFixed(2))}
      onChange={(value) => props.onChange(value / 100)}
      min={0}
      max={100}
      step={props.step ?? 0.5}
      suffix="%"
    />
  );
}

/** Two whole numbers that must stay min ≤ max; both turn red otherwise. */
export function RangeInputs(props: {
  label: string;
  min: number;
  max: number;
  onChange: (patch: { min?: number; max?: number }) => void;
  floor?: number;
  disabled?: boolean;
}) {
  const invalid = props.max < props.min;
  const shared = {
    invalid,
    integer: true,
    disabled: props.disabled,
    min: props.floor ?? 0,
  };
  return (
    <span className="flex items-center gap-1">
      <Num
        {...shared}
        label={`${props.label} minimum`}
        value={props.min}
        onChange={(min) => props.onChange({ min })}
      />
      <span className="text-white/30">–</span>
      <Num
        {...shared}
        label={`${props.label} maximum`}
        value={props.max}
        onChange={(max) => props.onChange({ max })}
      />
    </span>
  );
}

export function Toggle(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      title={props.label}
      onClick={() => props.onChange(!props.checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
        props.checked ? "bg-emerald-500/70" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
          props.checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

/** Small labelled slot for a form grid. */
export function Labeled(props: {
  label: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", props.className)}>
      <div className="text-xs font-medium text-white/60">{props.label}</div>
      {props.children}
      {props.hint ? (
        <div className="text-[11px] leading-snug text-white/40">
          {props.hint}
        </div>
      ) : null}
    </div>
  );
}

/** A titled card inside a detail pane. */
export function Card(props: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(cardClass, "space-y-3", props.className)}>
      {props.title ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{props.title}</h3>
            {props.description ? (
              <p className="mt-0.5 text-xs text-white/50">
                {props.description}
              </p>
            ) : null}
          </div>
          {props.action}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}

export function Art({ src, size }: { src: string; size: number }) {
  // next/image rejects relative or malformed paths while an admin is typing.
  if (!src.startsWith("/")) {
    return (
      <span
        className="block shrink-0 rounded-[8px] bg-black/30"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[8px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/** Title strip of a detail pane. */
export function DetailHeader(props: {
  image?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn(cardClass, "flex flex-wrap items-center gap-4")}>
      {props.image ? <Art src={props.image} size={56} /> : null}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-semibold">{props.title}</h2>
        {props.subtitle ? (
          <p className="text-xs text-white/50">{props.subtitle}</p>
        ) : null}
      </div>
      {props.children}
    </header>
  );
}

export type PickItem = {
  id: number;
  name: string;
  image?: string;
  detail: string;
  muted?: boolean;
};

/** Searchable list for the left column. */
export function PickList(props: {
  items: PickItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  placeholder: string;
  footer?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const items = needle
    ? props.items.filter((item) =>
        `${item.name} ${item.detail}`.toLowerCase().includes(needle),
      )
    : props.items;

  return (
    <aside className="flex flex-col gap-2 rounded-xl bg-gray-950/45 p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-white/35" />
        <input
          className={cn(editorInput, "pl-8")}
          placeholder={props.placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul className="max-h-72 space-y-0.5 overflow-y-auto lg:max-h-none lg:flex-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => props.onSelect(item.id)}
              aria-current={item.id === props.selectedId ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm transition-colors",
                item.id === props.selectedId
                  ? "bg-amber-400/15 text-white"
                  : "text-white/75 hover:bg-white/[0.05]",
                item.muted && item.id !== props.selectedId && "opacity-50",
              )}
            >
              {item.image !== undefined ? (
                <Art src={item.image} size={28} />
              ) : null}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                {item.detail}
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="px-2 py-3 text-sm text-white/45">Nothing found.</li>
        ) : null}
      </ul>
      {props.footer}
    </aside>
  );
}

/** A quiet "+ New …" action at the bottom of a PickList: a link or a button. */
export function ListAction(
  props: { children: React.ReactNode } & (
    | { href: string; onClick?: never }
    | { onClick: () => void; href?: never }
  ),
) {
  const className =
    "flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-xs text-white/55 hover:bg-white/[0.05] hover:text-white";
  const content = (
    <>
      <Plus className="h-3.5 w-3.5" />
      {props.children}
    </>
  );
  return props.href ? (
    <Link href={props.href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={props.onClick} className={className}>
      {content}
    </button>
  );
}

/** Selected id that falls back to the first entry when its row disappears. */
export function useSelection(ids: number[], initial?: number) {
  const [selected, setSelected] = useState(initial ?? ids[0] ?? null);
  const current =
    selected !== null && ids.includes(selected) ? selected : ids[0] ?? null;
  return [current, setSelected] as const;
}

/** Tab state kept in ?tab= without a server round trip that would reset edits. */
export function useUrlTab<K extends string>(
  keys: readonly K[],
  initial?: string,
) {
  const [tab, setTab] = useState<K>(
    keys.find((key) => key === initial) ?? keys[0]!,
  );
  const select = (next: K) => {
    setTab(next);
    window.history.replaceState(
      null,
      "",
      next === keys[0] ? window.location.pathname : `?tab=${next}`,
    );
  };
  return [tab, select] as const;
}

export function EditorTabs<K extends string>(props: {
  tabs: ReadonlyArray<{ key: K; label: string; count?: number }>;
  active: K;
  onSelect: (key: K) => void;
}) {
  return (
    <nav
      role="tablist"
      className="flex gap-1 overflow-x-auto border-b border-white/10"
    >
      {props.tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={props.active === tab.key}
          onClick={() => props.onSelect(tab.key)}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm",
            props.active === tab.key
              ? "border-amber-400 text-white"
              : "border-transparent text-white/55 hover:text-white",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="rounded bg-white/[0.06] px-1.5 text-[11px] tabular-nums text-white/60">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

export type Draft<T extends { id: number }> = {
  rows: T[];
  setRows: React.Dispatch<React.SetStateAction<T[]>>;
  update: (id: number, patch: Partial<T> | ((row: T) => Partial<T>)) => void;
  changed: T[];
  /** Saves every changed row; resolves to the errors of the rows that failed. */
  save: () => Promise<unknown[]>;
  discard: () => void;
};

/**
 * Local edits of server rows. `initial` must keep its identity between
 * renders (server props do); a new array means the server refreshed, and its
 * rows are adopted except where the admin has unsaved edits.
 */
export function useDraft<T extends { id: number }>(
  initial: T[],
  saveRow: (row: T, saved: T) => Promise<unknown>,
): Draft<T> {
  const [server, setServer] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [rows, setRows] = useState(initial);
  const savedById = new Map(saved.map((row) => [row.id, row]));
  if (server !== initial) {
    const editing = new Map(
      rows
        .filter((row) => !same(row, savedById.get(row.id)))
        .map((row) => [row.id, row]),
    );
    setServer(initial);
    setSaved(initial);
    setRows(initial.map((row) => editing.get(row.id) ?? row));
  }
  const changed = rows.filter((row) => !same(row, savedById.get(row.id)));

  return {
    rows,
    setRows,
    changed,
    update: (id, patch) =>
      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? { ...row, ...(typeof patch === "function" ? patch(row) : patch) }
            : row,
        ),
      ),
    save: async () => {
      const results = await Promise.allSettled(
        changed.map((row) =>
          saveRow(row, savedById.get(row.id) ?? row).then(() => row),
        ),
      );
      const done = new Map(
        results.flatMap((result) =>
          result.status === "fulfilled"
            ? [[result.value.id, result.value] as const]
            : [],
        ),
      );
      setSaved((current) => current.map((row) => done.get(row.id) ?? row));
      return results.flatMap((result) =>
        result.status === "rejected" ? [result.reason as unknown] : [],
      );
    },
    discard: () => setRows(saved),
  };
}

/** Saves a row by PATCHing `${endpoint}/${id}` with `toBody(row)`. */
export function patchRow<T extends { id: number }>(
  endpoint: string,
  toBody: (row: T) => unknown = (row) => row,
) {
  return (row: T) =>
    adminRequest(`${endpoint}/${row.id}`, "PATCH", toBody(row));
}

/** Sticky bar that saves or discards every draft on the page at once. */
export function SaveBar(props: {
  drafts: Array<Pick<Draft<{ id: number }>, "changed" | "save" | "discard">>;
  /** Blocking validation messages; saving waits until they are fixed. */
  problems?: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const count = props.drafts.reduce(
    (sum, draft) => sum + draft.changed.length,
    0,
  );
  const problems = props.problems ?? [];
  useLeaveGuard(count > 0);
  if (count === 0) return null;

  const save = async () => {
    setSaving(true);
    const errors = (
      await Promise.all(props.drafts.map((draft) => draft.save()))
    ).flat();
    setSaving(false);
    if (errors.length)
      toast.error(errorMessage(errors[0], "Some changes could not be saved"));
    else toast.success("Changes saved");
    router.refresh();
  };

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl bg-gray-900/95 p-3 shadow-2xl ring-1 ring-amber-400/30 backdrop-blur">
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Unsaved changes</span>
        <span className="text-white/55">
          {" "}
          · {count} {count === 1 ? "entry" : "entries"} edited
        </span>
        {problems.length ? (
          <div
            className="truncate text-xs text-red-300"
            title={problems.join("\n")}
          >
            Fix before saving: {problems.join(" · ")}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={saving}
        onClick={() => props.drafts.forEach((draft) => draft.discard())}
      >
        <Undo2 className="h-4 w-4" />
        Discard
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={saving || problems.length > 0}
        onClick={() => void save()}
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save all"}
      </Button>
    </div>
  );
}

/** Runs a create or delete request, then reloads server rows into the drafts. */
export function useServerAction() {
  const router = useRouter();
  return async (
    run: () => Promise<Record<string, unknown> | null>,
    success: string,
  ) => {
    try {
      const result = await run();
      toast.success(success);
      router.refresh();
      return result;
    } catch (error) {
      toast.error(errorMessage(error, "Request failed"));
      return null;
    }
  };
}

type DurationRow = {
  id: number;
  label: string;
  durationSeconds: number;
  enabled: boolean;
  sortOrder: number;
};

/** Expedition durations table shared by the activity editors. */
export function DurationTable<T extends DurationRow>(props: {
  draft: Draft<T>;
  endpoint: string;
  description: React.ReactNode;
  /** Activity-specific numeric columns between Hours and Order. */
  columns: Array<{
    key: keyof T & string;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    integer?: boolean;
  }>;
  /** Body for a new, disabled duration following the last one. */
  newRow: (last: T | undefined) => Omit<T, "id">;
}) {
  const run = useServerAction();
  const { draft } = props;
  return (
    <Card
      title="Expedition durations"
      description={props.description}
      action={
        <Button
          type="button"
          size="sm"
          variant="soft"
          onClick={() =>
            void run(
              () =>
                adminRequest(
                  props.endpoint,
                  "POST",
                  props.newRow(draft.rows.at(-1)),
                ),
              "Duration added (disabled)",
            )
          }
        >
          <Plus className="h-4 w-4" />
          Add duration
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className={theadClass}>
            <tr>
              <th>Label</th>
              <th className="w-24">Hours</th>
              {props.columns.map((column) => (
                <th key={column.key} className="w-24">
                  {column.label}
                </th>
              ))}
              <th className="w-20">Order</th>
              <th className="w-12">On</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row) => (
              <tr key={row.id} className={rowClass}>
                <td>
                  <input
                    aria-label="Label"
                    className={editorInput}
                    value={row.label}
                    onChange={(event) =>
                      draft.update(row.id, {
                        label: event.target.value,
                      } as Partial<T>)
                    }
                  />
                </td>
                <td>
                  <Num
                    label={`${row.label} hours`}
                    value={row.durationSeconds / 3_600}
                    min={1 / 60}
                    max={168}
                    step={0.25}
                    onChange={(hours) =>
                      draft.update(row.id, {
                        durationSeconds: Math.round(hours * 3_600),
                      } as Partial<T>)
                    }
                  />
                </td>
                {props.columns.map((column) => (
                  <td key={column.key}>
                    <Num
                      label={`${row.label} ${column.label}`}
                      value={row[column.key] as number}
                      min={column.min}
                      max={column.max}
                      step={column.step}
                      integer={column.integer}
                      onChange={(value) =>
                        draft.update(row.id, {
                          [column.key]: value,
                        } as Partial<T>)
                      }
                    />
                  </td>
                ))}
                <td>
                  <Num
                    label={`${row.label} order`}
                    value={row.sortOrder}
                    integer
                    onChange={(sortOrder) =>
                      draft.update(row.id, { sortOrder } as Partial<T>)
                    }
                  />
                </td>
                <td>
                  <Toggle
                    label={`${row.label} enabled`}
                    checked={row.enabled}
                    onChange={(enabled) =>
                      draft.update(row.id, { enabled } as Partial<T>)
                    }
                  />
                </td>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    aria-label={`Delete ${row.label}`}
                    onClick={() => {
                      if (!window.confirm(`Delete the ${row.label} duration?`))
                        return;
                      void run(
                        () =>
                          adminRequest(`${props.endpoint}/${row.id}`, "DELETE"),
                        "Duration deleted",
                      );
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-300" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
