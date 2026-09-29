"use client";

import Image from "next/image";
import React from "react";
import {
  Coins,
  Hammer,
  Pickaxe,
  ScrollText,
  Skull,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import type { VocationalActionType } from "~/generated/prisma/enums";
import { getSkillLabel } from "~/game/crafting";
import type { GraphItem } from "~/game/itemGraph/content";
import type { IssueSeverity } from "~/game/itemGraph/diagnostics";
import type { ItemGraph } from "~/game/itemGraph/graph";
import { SKILL_COLORS, SOURCE_KINDS, type ItemRole, type SourceKind } from "~/game/itemGraph/taxonomy";
import { cn } from "~/lib/utils";
import { rarityStyle } from "~/utils/rarity-colors";

export const SOURCE_ICONS: Record<SourceKind, LucideIcon> = {
  CRAFTED: Hammer,
  GATHERED: Pickaxe,
  GROWN: Sprout,
  DROPPED: Skull,
  SOLD: Coins,
  QUEST: ScrollText,
};

export const SOURCE_LABELS = Object.fromEntries(
  SOURCE_KINDS.map(({ kind, label }) => [kind, label]),
) as Record<SourceKind, string>;

/** Accent per role, used as the node's edge stripe and in the minimap. */
export const ROLE_COLORS: Record<ItemRole, string> = {
  RAW: "#a8a29e",
  INTERMEDIATE: "#7dd3fc",
  FINISHED: "#fbbf24",
};

export const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  error: "#f87171",
  warning: "#fbbf24",
  info: "#7dd3fc",
};

export function ItemArt(props: {
  item: Pick<GraphItem, "sprite" | "rarity" | "name">;
  size?: number;
  className?: string;
}) {
  const size = props.size ?? 32;
  return (
    <span
      className={cn("rarity-frame relative grid shrink-0 place-items-center rounded-md p-0.5", props.className)}
      data-rarity={props.item.rarity}
      style={{ ...rarityStyle(props.item.rarity), width: size, height: size }}
    >
      {props.item.sprite.startsWith("/") ? (
        <Image
          src={props.item.sprite}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : null}
    </span>
  );
}

/** One icon per way the item can be obtained; faded when switched off. */
export function SourceIcons(props: { graph: ItemGraph; itemId: number; className?: string }) {
  const sources = props.graph.sources.get(props.itemId) ?? [];
  const kinds = new Map<SourceKind, boolean>();
  for (const source of sources) kinds.set(source.kind, (kinds.get(source.kind) ?? false) || source.available);
  if (kinds.size === 0) {
    return <span className={cn("text-[11px] font-medium text-red-300", props.className)}>no source</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1", props.className)}>
      {SOURCE_KINDS.filter(({ kind }) => kinds.has(kind)).map(({ kind, label }) => {
        const Icon = SOURCE_ICONS[kind];
        const on = kinds.get(kind);
        const title = on ? label : `${label} (switched off)`;
        return (
          <span key={kind} title={title} aria-label={title} role="img">
            <Icon className={cn("h-3.5 w-3.5", on ? "text-white/70" : "text-white/25")} />
          </span>
        );
      })}
    </span>
  );
}

export function SkillDot(props: { skill: VocationalActionType; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", props.className)}
      style={{ background: SKILL_COLORS[props.skill] }}
    />
  );
}

export function SkillLabel(props: { skill: VocationalActionType; level?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", props.className)}>
      <SkillDot skill={props.skill} />
      <span>
        {getSkillLabel(props.skill)}
        {props.level !== undefined && props.level > 1 ? ` ${props.level}` : null}
      </span>
    </span>
  );
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** A short line saying how an item is made or obtained. */
export function productionLabel(graph: ItemGraph, itemId: number): React.ReactNode {
  const recipe = graph.recipeByItem.get(itemId);
  if (recipe) return <SkillLabel skill={recipe.skill} level={recipe.requiredSkillLevel} />;
  const first = graph.sources.get(itemId)?.[0];
  if (!first) return <span className="text-red-300">No source</span>;
  if (first.kind === "GROWN") return <SkillLabel skill={first.skill} />;
  return <span>{SOURCE_LABELS[first.kind]}</span>;
}
