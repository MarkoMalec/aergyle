"use client";

import Image from "next/image";
import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  FileCode2,
  ImageOff,
  type LucideIcon,
  Plus,
  X,
} from "lucide-react";
import type { ItemRarity } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
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
import {
  resolveRarityColor,
  resolveRarityTextColor,
} from "~/utils/rarity-colors";
import type { ChoiceOption } from "./itemFormOptions";

/** A borderless input on a tinted fill. */
export const controlClass =
  "h-9 w-full min-w-0 rounded-lg bg-white/[0.06] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 hover:bg-white/[0.08] focus:bg-white/[0.09] focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-40";

/** Number inputs without spinner buttons, with digits that line up. */
export const numberClass =
  "tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export const invalidClass =
  "bg-red-500/10 ring-1 ring-red-400/50 hover:bg-red-500/[0.12] focus:ring-red-400/60";

const triggerClass =
  "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg bg-white/[0.06] px-3 text-left text-sm text-white outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-40 data-[state=open]:bg-white/[0.09]";

/** One titled block of the editor; `id` is its anchor in the section bar. */
export function FormSection(props: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "danger";
  children?: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <section
      id={props.id}
      aria-labelledby={`${props.id}-title`}
      className={cn(
        "scroll-mt-20 rounded-xl p-5",
        props.tone === "danger" ? "bg-red-500/[0.06]" : "bg-gray-950/45",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2
            id={`${props.id}-title`}
            className="flex items-center gap-2 font-semibold text-white"
          >
            <Icon
              aria-hidden
              className={cn(
                "h-4 w-4",
                props.tone === "danger" ? "text-red-300/80" : "text-white/40",
              )}
            />
            {props.title}
          </h2>
          {props.description ? (
            <p className="mt-1 max-w-3xl text-sm text-white/50">
              {props.description}
            </p>
          ) : null}
        </div>
        {props.actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {props.actions}
          </div>
        ) : null}
      </div>
      {props.children ? <div className="mt-5">{props.children}</div> : null}
    </section>
  );
}

/** A label above its control, with a hint or an error underneath. */
export function Field(props: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", props.className)}>
      <label
        htmlFor={props.htmlFor}
        className="block text-xs font-medium text-white/60"
      >
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <p role="alert" className="text-[11px] leading-snug text-red-300">
          {props.error}
        </p>
      ) : props.hint ? (
        <p className="text-[11px] leading-snug text-white/40">{props.hint}</p>
      ) : null}
    </div>
  );
}

/** Puts a unit such as "gold" or "%" inside the end of an input. */
export function WithSuffix(props: {
  suffix: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", props.className)}>
      {props.children}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-white/35">
        {props.suffix}
      </span>
    </div>
  );
}

export function Switch(props: {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      id={props.id}
      type="button"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      className={cn(
        "group flex items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40",
        props.className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-px flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          props.checked
            ? "bg-amber-400"
            : "bg-white/15 group-hover:bg-white/20",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full shadow-sm transition-transform",
            props.checked ? "translate-x-4 bg-gray-950" : "bg-white/80",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-white/85">{props.label}</span>
        {props.description ? (
          <span className="block text-[11px] leading-snug text-white/40">
            {props.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ChoiceLabel<T extends string>(props: { option: ChoiceOption<T> }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {props.option.color ? (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: props.option.color }}
        />
      ) : null}
      <span className="truncate">{props.option.label}</span>
    </span>
  );
}

const NONE_VALUE = "__none__";

/**
 * A searchable picker for a fixed set of values, grouped like the options.
 * Search matches the label and the enum name, so either can be typed.
 */
export function ChoicePicker<T extends string>(props: {
  id?: string;
  value: T | null;
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (value: T | null) => void;
  placeholder?: string;
  /** Offers a choice that clears the value, shown with this label. */
  noneLabel?: string;
  ariaLabel?: string;
  compact?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    props.options.find((option) => option.value === props.value) ?? null;
  const groups = useMemo(() => {
    const byGroup = new Map<string, Array<ChoiceOption<T>>>();
    for (const option of props.options) {
      const key = option.group ?? "";
      byGroup.set(key, [...(byGroup.get(key) ?? []), option]);
    }
    return [...byGroup];
  }, [props.options]);
  const choose = (value: T | null) => {
    props.onChange(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={props.id}
          type="button"
          aria-label={props.ariaLabel}
          disabled={props.disabled}
          className={cn(
            triggerClass,
            props.compact ? "h-8" : "h-9",
            props.invalid && invalidClass,
            props.className,
          )}
        >
          {selected ? (
            <ChoiceLabel option={selected} />
          ) : (
            <span className="truncate text-white/40">
              {props.noneLabel ?? props.placeholder ?? "Choose…"}
            </span>
          )}
          <ChevronsUpDown
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-white/35"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] overflow-hidden border-0 p-0"
      >
        <Command
          defaultValue={props.value ?? NONE_VALUE}
          className="bg-transparent [&_[cmdk-input-wrapper]]:border-0 [&_[cmdk-input-wrapper]]:bg-white/[0.04]"
        >
          <CommandInput placeholder="Search…" className="h-9" />
          <CommandList className="max-h-[min(320px,var(--radix-popover-content-available-height,320px))]">
            <CommandEmpty className="py-5 text-center text-xs text-white/40">
              Nothing matches
            </CommandEmpty>
            {props.noneLabel ? (
              <CommandGroup>
                <CommandItem
                  value={NONE_VALUE}
                  keywords={[props.noneLabel]}
                  onSelect={() => choose(null)}
                  className="text-white/60"
                >
                  {props.noneLabel}
                  <Check
                    aria-hidden
                    className={cn(
                      "ml-auto",
                      props.value === null ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              </CommandGroup>
            ) : null}
            {groups.map(([group, options]) => (
              <CommandGroup key={group || "_"} heading={group || undefined}>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, option.keywords ?? ""]}
                    onSelect={() => choose(option.value)}
                  >
                    <ChoiceLabel option={option} />
                    <Check
                      aria-hidden
                      className={cn(
                        "ml-auto",
                        option.value === props.value
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ErrorNote(props: {
  children: React.ReactNode;
  tone?: "error" | "warning";
}) {
  return (
    <p
      role={props.tone === "warning" ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
        props.tone === "warning"
          ? "bg-amber-400/10 text-amber-100/90"
          : "bg-red-500/10 text-red-200",
      )}
    >
      <AlertCircle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">{props.children}</span>
    </p>
  );
}

/** Switches a table between its editor and raw CSV. */
export function CsvToggle(props: {
  raw: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.raw}
      title={props.title ?? (props.raw ? "Back to rows" : "Edit as CSV")}
      onClick={props.onToggle}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/40",
        props.raw
          ? "bg-amber-400/15 text-amber-100 hover:bg-amber-400/20"
          : "text-white/40 hover:bg-white/[0.06] hover:text-white/80",
      )}
    >
      <FileCode2 aria-hidden className="h-3.5 w-3.5" />
      CSV
    </button>
  );
}

/**
 * A list of rows edited in place, with an optional raw CSV mode. `columns` is
 * the grid template for the header and every row; its last track holds the
 * remove button.
 */
export function ListEditor(props: {
  title: string;
  description?: React.ReactNode;
  columns: string;
  headers: string[];
  count: number;
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  empty: string;
  raw: boolean;
  onToggleRaw: () => void;
  error: string | null;
  rawEditor: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-white/90">{props.title}</h3>
          {props.description ? (
            <p className="mt-0.5 text-xs leading-snug text-white/45">
              {props.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!props.raw ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-white/75"
              disabled={props.addDisabled}
              onClick={props.onAdd}
            >
              <Plus aria-hidden className="h-3.5 w-3.5" />
              {props.addLabel}
            </Button>
          ) : null}
          <CsvToggle raw={props.raw} onToggle={props.onToggleRaw} />
        </div>
      </div>
      {props.error ? <ErrorNote>{props.error}</ErrorNote> : null}
      {props.raw ? (
        props.rawEditor
      ) : props.count === 0 ? (
        <button
          type="button"
          disabled={props.addDisabled}
          onClick={props.onAdd}
          className="flex w-full items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white/40 outline-none transition-colors hover:bg-white/[0.05] hover:text-white/70 focus-visible:ring-2 focus-visible:ring-amber-400/40"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" />
          {props.empty}
        </button>
      ) : (
        <div className="space-y-1.5">
          <div
            aria-hidden
            className={cn(
              "grid gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-white/35",
              props.columns,
            )}
          >
            {props.headers.map((header, index) => (
              <span key={index} className="truncate">
                {header}
              </span>
            ))}
          </div>
          {props.children}
        </div>
      )}
    </div>
  );
}

export function ListRow(props: {
  columns: string;
  removeLabel: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid items-center gap-2", props.columns)}>
      {props.children}
      <button
        type="button"
        aria-label={props.removeLabel}
        title="Remove"
        onClick={props.onRemove}
        className="grid h-8 w-8 place-items-center rounded-md text-white/30 outline-none transition-colors hover:bg-red-500/15 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-400/40"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

/** The raw CSV form of a list, bound to its form field. */
export function CsvEditor(props: {
  format: string;
  example: string;
  textarea: React.ComponentProps<"textarea">;
  onApply: () => void;
}) {
  return (
    <div className="space-y-2">
      <textarea
        spellCheck={false}
        rows={5}
        placeholder={props.example}
        {...props.textarea}
        className={cn(
          controlClass,
          "h-auto min-h-[120px] resize-y py-2 font-mono text-xs leading-relaxed",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-white/40">
          One row per line:{" "}
          <code className="font-mono text-white/60">{props.format}</code>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7"
          onClick={props.onApply}
        >
          Back to rows
        </Button>
      </div>
    </div>
  );
}

export function RarityChip(props: {
  rarity: ItemRarity;
  /** A custom colour from the rarity config. */
  color?: string;
  label: string;
}) {
  const color = resolveRarityColor(props.rarity, props.color);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{
        color: resolveRarityTextColor(props.rarity, props.color),
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {props.label}
    </span>
  );
}

/** The item's art on a tile tinted by its rarity; a missing file shows as such. */
export function SpriteTile(props: {
  sprite: string;
  color: string;
  size: number;
  className?: string;
  /** Called with the path when no image loads from it. */
  onMissing?: (src: string) => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = props.sprite.trim();
  const missing = !src || failedSrc === src;

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-xl",
        props.className,
      )}
      style={{
        width: props.size,
        height: props.size,
        background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${props.color} 24%, transparent), color-mix(in srgb, ${props.color} 6%, rgb(0 0 0 / 0.3)))`,
      }}
    >
      {missing ? (
        <ImageOff aria-hidden className="h-1/3 w-1/3 text-white/25" />
      ) : (
        <Image
          key={src}
          src={src}
          alt=""
          width={props.size}
          height={props.size}
          unoptimized
          onError={() => {
            setFailedSrc(src);
            props.onMissing?.(src);
          }}
          className="h-full w-full object-contain p-[12%]"
        />
      )}
    </div>
  );
}
