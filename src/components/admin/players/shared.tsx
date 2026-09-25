"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { createContext, useContext, useState } from "react";
import toast from "react-hot-toast";
import { adminRequest } from "~/components/admin/fields";
import { Button, type ButtonProps } from "~/components/ui/button";
import type { ItemRarity } from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import type { AdminPlayer, AdminPlayerOptions } from "~/server/admin/players";
import { rarityStyle } from "~/utils/rarity-colors";

type Method = "POST" | "PATCH" | "DELETE";
type Result = Awaited<ReturnType<typeof adminRequest>>;

type PlayerEdit = {
  player: AdminPlayer;
  options: AdminPlayerOptions;
  /** The key of the request in flight, so its button can show it. */
  busy: string | null;
  /**
   * Sends one change for this player, toasts the outcome and reloads the
   * page's data. Resolves to the response, or null when it failed.
   */
  run: (
    key: string,
    path: string,
    method: Method,
    body?: unknown,
    done?: string | ((result: Result) => string),
  ) => Promise<Result | null>;
};

const PlayerEditContext = createContext<PlayerEdit | null>(null);

export function PlayerEditProvider(props: {
  player: AdminPlayer;
  options: AdminPlayerOptions;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run: PlayerEdit["run"] = async (key, path, method, body, done) => {
    setBusy(key);
    try {
      const result = await adminRequest(
        `/api/admin/players/${props.player.account.id}${path}`,
        method,
        body,
      );
      toast.success(typeof done === "function" ? done(result) : (done ?? "Saved"));
      router.refresh();
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  return (
    <PlayerEditContext.Provider
      value={{ player: props.player, options: props.options, busy, run }}
    >
      {props.children}
    </PlayerEditContext.Provider>
  );
}

export function usePlayerEdit() {
  const context = useContext(PlayerEditContext);
  if (!context) throw new Error("usePlayerEdit needs a PlayerEditProvider");
  return context;
}

/** A button tied to one request key: disabled while any request runs. */
export function ActionButton({
  actionKey,
  confirm,
  onClick,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  actionKey: string;
  /** Asked first; the action runs only if the admin agrees. */
  confirm?: string;
  onClick: () => unknown;
}) {
  const { busy } = usePlayerEdit();
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      {...props}
      disabled={busy !== null || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        void onClick();
      }}
    >
      {busy === actionKey ? "Working…" : children}
    </Button>
  );
}

export function ItemArt(props: {
  sprite: string;
  rarity: ItemRarity;
  quantity?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rarity-frame relative grid h-10 w-10 shrink-0 place-items-center rounded-lg p-1",
        props.className,
      )}
      data-rarity={props.rarity}
      style={rarityStyle(props.rarity)}
    >
      <Image
        src={props.sprite}
        alt=""
        width={36}
        height={36}
        className="h-full w-full object-contain"
      />
      {props.quantity !== undefined && props.quantity > 1 ? (
        <span className="absolute bottom-0 right-1 text-[11px] font-bold tabular-nums text-white [text-shadow:0_1px_2px_black]">
          {props.quantity.toLocaleString()}
        </span>
      ) : null}
    </span>
  );
}

/** A tinted row, the admin's list surface. */
export function Row(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg bg-black/25 px-4 py-3",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function Empty(props: { children: React.ReactNode }) {
  return <p className="text-sm text-white/45">{props.children}</p>;
}

export function Tag(props: {
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  children: React.ReactNode;
}) {
  const tone = {
    neutral: "bg-white/10 text-white/65",
    good: "bg-emerald-400/15 text-emerald-300",
    warn: "bg-amber-400/15 text-amber-200",
    bad: "bg-red-400/15 text-red-300",
    info: "bg-sky-400/10 text-sky-200",
  }[props.tone ?? "neutral"];
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold",
        tone,
      )}
    >
      {props.children}
    </span>
  );
}

/** "WOODCUTTING" → "Woodcutting", "EVASION_MELEE" → "Evasion melee". */
export function humanize(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const formatGold = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/** "2h 5m", "40s": a duration in seconds, short. */
export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** "in 5m", "3m ago" relative to now. */
export function fromNow(value: string) {
  const delta = (new Date(value).getTime() - Date.now()) / 1000;
  return delta >= 0
    ? `in ${formatDuration(delta)}`
    : `${formatDuration(-delta)} ago`;
}
