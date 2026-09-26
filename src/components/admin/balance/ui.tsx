"use client";

import React from "react";
import { NumberInput } from "~/components/admin/fields";
import { cn } from "~/lib/utils";

/** A row of mutually exclusive options. */
export function Segmented<T extends string>(props: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={props.label}
      className={cn("inline-flex flex-wrap gap-1 rounded-lg bg-black/25 p-1", props.className)}
    >
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === props.value}
          title={option.title}
          onClick={() => props.onChange(option.value)}
          className={cn(
            "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            option.value === props.value
              ? "bg-white/10 text-white"
              : "text-white/60 hover:bg-white/5 hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** An on/off pill, for picking several things from a set. */
export function Chip(props: {
  on: boolean;
  onChange: (on: boolean) => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      title={props.title}
      onClick={() => props.onChange(!props.on)}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        props.on
          ? "bg-amber-400/15 text-amber-100"
          : "bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-white/80",
      )}
    >
      {props.children}
    </button>
  );
}

export function StatTile(props: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-3">
      <div className="text-xs text-white/50">{props.label}</div>
      <div className="mt-0.5 text-xl font-semibold">{props.value}</div>
      {props.hint ? <div className="mt-0.5 text-[11px] text-white/40">{props.hint}</div> : null}
    </div>
  );
}

/** A range slider with its exact value editable beside it. */
export function SliderField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  hint?: React.ReactNode;
  suffix?: string;
  /** Marks the field when its value is what breaks the design. */
  invalid?: boolean;
  /**
   * Logarithmic track, for values spanning magnitudes: each step multiplies
   * rather than adds, so 5 and 5,000 are both easy to fine-tune.
   */
  logarithmic?: boolean;
}) {
  const { min, max } = props;
  const steps = 1_000;
  const toTrack = (value: number) =>
    props.logarithmic
      ? Math.round((Math.log(Math.max(min, value) / min) / Math.log(max / min)) * steps)
      : value;
  const fromTrack = (position: number) =>
    props.logarithmic
      ? Number((min * Math.pow(max / min, position / steps)).toPrecision(3))
      : position;
  return (
    <label className="block space-y-1 text-xs text-white/55">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium text-white/70">{props.label}</span>
        <span className="flex items-center gap-1">
          <NumberInput
            aria-label={props.label}
            className={cn(
              "w-20 rounded-md border bg-black/25 px-2 py-1 text-right text-sm text-white outline-none focus:border-amber-400/60",
              props.invalid ? "border-red-400/60" : "border-white/10",
            )}
            value={props.value}
            step={props.step}
            min={props.min}
            onValueChange={(value) => {
              if (value !== null) props.onChange(value);
            }}
          />
          {props.suffix ? <span className="text-white/40">{props.suffix}</span> : null}
        </span>
      </span>
      <input
        type="range"
        aria-hidden="true"
        tabIndex={-1}
        className="w-full accent-amber-400"
        min={props.logarithmic ? 0 : min}
        max={props.logarithmic ? steps : max}
        step={props.logarithmic ? 1 : props.step}
        value={toTrack(Math.min(max, Math.max(min, props.value)))}
        onChange={(event) => props.onChange(fromTrack(event.target.valueAsNumber))}
      />
      {props.hint ? <span className="block text-[11px] leading-snug text-white/40">{props.hint}</span> : null}
    </label>
  );
}
