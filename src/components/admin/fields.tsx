"use client";

import React from "react";
import { cn } from "~/lib/utils";

export const inputClass =
  "w-full rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-sm text-white outline-none focus:border-amber-400/60";
export const labelClass = "space-y-1 text-xs text-white/55";

export async function responseJson(response: Response) {
  return (await response.json().catch(() => null)) as {
    error?: string;
    [key: string]: unknown;
  } | null;
}

/** Sends an admin JSON request and throws the API's error message on failure. */
export async function adminRequest(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await responseJson(response);
  if (!response.ok) throw new Error(json?.error ?? "Request failed");
  return json;
}

/** A labelled control with an optional one-line explanation underneath. */
export function Field(props: {
  label: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn(labelClass, "block", props.className)}>
      <span className="font-medium text-white/70">{props.label}</span>
      {props.children}
      {props.hint ? (
        <span className="block text-[11px] leading-snug text-white/40">
          {props.hint}
        </span>
      ) : null}
    </label>
  );
}

function toNumberText(value: number | null) {
  return value === null ? "" : String(value);
}

function parseNumberText(text: string) {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * A controlled number input that keeps unfinished typing such as "0." instead
 * of snapping it back to a number, so decimals like 0.001 can be entered.
 * An emptied field reports null; the field shows the current value on blur.
 */
export function NumberInput({
  value,
  onValueChange,
  onBlur,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
}) {
  const [text, setText] = React.useState(toNumberText(value));
  // Follow outside changes (resets, clamping) without rewriting "0.0" to "0".
  React.useEffect(() => {
    setText((current) =>
      parseNumberText(current) === value ? current : toNumberText(value),
    );
  }, [value]);

  return (
    <input
      {...props}
      type="number"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        // Browsers report an unfinished number such as "0." as "".
        if (event.target.validity.badInput) return;
        onValueChange(parseNumberText(event.target.value));
      }}
      onBlur={(event) => {
        setText(toNumberText(value));
        onBlur?.(event);
      }}
    />
  );
}

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: React.ReactNode;
  suffix?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <Field label={props.label} hint={props.hint} className={props.className}>
      <span className="relative block">
        <NumberInput
          className={cn(inputClass, props.suffix && "pr-14")}
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          disabled={props.disabled}
          onValueChange={(value) => {
            if (value !== null) props.onChange(value);
          }}
        />
        {props.suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-white/40">
            {props.suffix}
          </span>
        ) : null}
      </span>
    </Field>
  );
}

export function EnabledField(props: {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  hint?: React.ReactNode;
}) {
  return (
    <Field label={props.label ?? "Status"} hint={props.hint}>
      <select
        className={inputClass}
        value={props.value ? "yes" : "no"}
        onChange={(event) => props.onChange(event.target.value === "yes")}
      >
        <option value="yes">Enabled</option>
        <option value="no">Disabled</option>
      </select>
    </Field>
  );
}
