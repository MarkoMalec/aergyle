"use client";

import Link from "next/link";
import React, { useState } from "react";
import { Crosshair, ExternalLink, ListTree, MapPin, Pencil, Plus, Split } from "lucide-react";
import { Button } from "~/components/ui/button";
import { getSkillLabel } from "~/game/crafting";
import { ISSUE_TYPES, type Issue } from "~/game/itemGraph/diagnostics";
import {
  isCraftingSkill,
  outputsOf,
  sourcesOf,
  usesOf,
  type ItemGraph,
  type ItemSource,
} from "~/game/itemGraph/graph";
import { CATEGORY_LABELS, ROLE_LABELS } from "~/game/itemGraph/taxonomy";
import { cn } from "~/lib/utils";
import { InsertStepDialog, LocationsDialog, UseInDialog } from "./ChainDialogs";
import {
  formatDuration,
  formatNumber,
  ItemArt,
  ROLE_COLORS,
  SEVERITY_COLORS,
  SkillLabel,
  SourceIcons,
  SOURCE_ICONS,
  SOURCE_LABELS,
} from "./parts";
import { RecipeEditor } from "./RecipeEditor";

/**
 * Everything about one item, answering where it comes from, what it needs and
 * what it leads to, and the place to change those. Mount it keyed by item.
 */
export function Inspector(props: {
  graph: ItemGraph;
  itemId: number;
  focusId: number | null;
  issues: Issue[];
  onSelect: (itemId: number) => void;
  onFocus: (itemId: number) => void;
  onShowTree: (itemId: number) => void;
}) {
  const { graph, itemId } = props;
  const item = graph.items.get(itemId);
  const [editing, setEditing] = useState(false);
  const [insertFor, setInsertFor] = useState<number | null>(null);
  const [useIn, setUseIn] = useState(false);
  const [locationsFor, setLocationsFor] = useState<number | null>(null);
  if (!item) return null;

  const facts = graph.facts.get(itemId)!;
  const recipe = graph.recipeByItem.get(itemId) ?? null;
  const sources = sourcesOf(graph, itemId);
  const feeds = groupFeeds(graph, itemId);
  const uses = usesOf(graph, itemId);

  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <ItemArt item={item} size={52} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold leading-tight text-white">{item.name}</div>
            <div className="mt-0.5 text-xs text-white/45">
              #{item.id} · {item.itemType ?? "untyped"} · {item.rarity.toLowerCase()}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip color={ROLE_COLORS[facts.role]}>{ROLE_LABELS[facts.role]}</Chip>
              <Chip>Tier {facts.tier}</Chip>
              <Chip>{CATEGORY_LABELS[facts.category]}</Chip>
              {!facts.obtainable ? <Chip color="#f87171">Unobtainable</Chip> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {props.focusId !== itemId ? (
            <Button size="sm" variant="secondary" onClick={() => props.onFocus(itemId)}>
              <Crosshair className="h-3.5 w-3.5" /> Focus
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => props.onShowTree(itemId)}>
            <ListTree className="h-3.5 w-3.5" /> Bill of materials
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href={`/admin/items/${itemId}`} target="_blank">
              Edit item <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Leads to" value={facts.reach} hint="Items it eventually helps make" />
          <Stat label="Needs" value={facts.upstream} hint="Distinct items somewhere upstream" />
          <Stat label="Used by" value={facts.usedBy + facts.otherUses} hint="Direct recipes, quests and projects" />
        </div>
      </div>

      {props.issues.length > 0 ? (
        <div className="space-y-1.5">
          {props.issues.map((issue, i) => (
            <div key={i} className="flex gap-2 rounded-md bg-white/[0.04] px-2.5 py-2 text-xs">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLORS[issue.severity] }} />
              <div className="min-w-0">
                <div className="font-medium text-white/85">{ISSUE_TYPES[issue.code].title}</div>
                <div className="text-white/55">{issue.message}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Section title="Where it comes from" count={sources.length}>
        {sources.length === 0 ? (
          <p className="text-xs text-red-300/90">Nothing crafts, gathers, grows, drops, sells or rewards it.</p>
        ) : (
          sources.map((source, i) => (
            <SourceRow
              key={i}
              graph={graph}
              source={source}
              onSelect={props.onSelect}
              onEdit={() => setEditing(true)}
              onLocations={(id) => setLocationsFor(id)}
            />
          ))
        )}
      </Section>

      <Section
        title="What it needs"
        count={recipe?.inputs.length ?? 0}
        action={
          !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-white/55 hover:text-white">
              {recipe ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {recipe ? "Edit recipe" : "Add recipe"}
            </button>
          ) : null
        }
      >
        {editing ? (
          <RecipeEditor
            graph={graph}
            itemId={itemId}
            recipe={recipe}
            onClose={() => setEditing(false)}
            onSaved={(recipeId, created) => {
              setEditing(false);
              if (created) setLocationsFor(recipeId);
            }}
          />
        ) : !recipe ? (
          <p className="text-xs text-white/45">Not crafted: it enters the game as it is.</p>
        ) : recipe.inputs.length === 0 ? (
          <p className="text-xs text-white/45">{getSkillLabel(recipe.skill)} produces it from nothing.</p>
        ) : (
          <>
            {recipe.inputs.map((input) => (
              <ItemRow
                key={input.itemId}
                graph={graph}
                itemId={input.itemId}
                onSelect={props.onSelect}
                onFocus={props.onFocus}
                detail={<span className="font-semibold tabular-nums text-white/80">×{input.quantity}</span>}
                action={
                  isCraftingSkill(recipe.skill) ? (
                    <RowAction label="Insert a step between them" onClick={() => setInsertFor(input.itemId)}>
                      <Split className="h-3.5 w-3.5 rotate-90" />
                    </RowAction>
                  ) : null
                }
              />
            ))}
            {recipe.unlockItemId !== null ? (
              <ItemRow
                graph={graph}
                itemId={recipe.unlockItemId}
                onSelect={props.onSelect}
                onFocus={props.onFocus}
                detail={<span className="text-white/50">learn once</span>}
              />
            ) : null}
            <p className="pt-1 text-[11px] text-white/40">
              Per craft · <SkillLabel skill={recipe.skill} level={recipe.requiredSkillLevel} /> · {formatDuration(recipe.defaultSeconds)}
              {recipe.yieldPerUnit > 1 ? ` · makes ${recipe.yieldPerUnit}` : ""}
            </p>
          </>
        )}
      </Section>

      <Section
        title="What it leads to"
        count={feeds.length + uses.length}
        action={
          <button type="button" onClick={() => setUseIn(true)} className="flex items-center gap-1 text-xs text-white/55 hover:text-white">
            <Plus className="h-3 w-3" /> Use in recipe
          </button>
        }
      >
        {feeds.length === 0 && uses.length === 0 ? (
          <p className="text-xs text-white/45">Nothing uses it.</p>
        ) : null}
        {feeds.map((feed) => (
          <ItemRow
            key={feed.to}
            graph={graph}
            itemId={feed.to}
            onSelect={props.onSelect}
            onFocus={props.onFocus}
            detail={<span className="text-white/60">{feed.label}</span>}
          />
        ))}
        {uses.map((use, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-white/65">
            <span className="truncate">
              {use.kind === "QUEST" ? `Quest "${use.delivery.questName}"` : `Project "${use.need.projectName}"`}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums text-white/80">×{use.kind === "QUEST" ? use.delivery.quantity : use.need.quantity}</span>
              <Link
                href={use.kind === "QUEST" ? `/admin/npcs/${use.delivery.npcId}` : `/admin/settlements/${use.need.settlementId}`}
                target="_blank"
                className="text-white/40 hover:text-white"
                aria-label="Open in its editor"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </span>
          </div>
        ))}
      </Section>

      {insertFor !== null && recipe ? (
        <InsertStepDialog
          graph={graph}
          productId={itemId}
          ingredientId={insertFor}
          open
          onOpenChange={(open) => !open && setInsertFor(null)}
          onDone={() => setInsertFor(null)}
        />
      ) : null}
      {useIn ? <UseInDialog graph={graph} itemId={itemId} open onOpenChange={setUseIn} /> : null}
      <LocationsDialog graph={graph} recipeId={locationsFor} onOpenChange={(open) => !open && setLocationsFor(null)} />
    </div>
  );
}

/** Direct consumers, one row per item, with how much of this item each uses. */
function groupFeeds(graph: ItemGraph, itemId: number) {
  const byTarget = new Map<number, string[]>();
  for (const link of outputsOf(graph, itemId)) {
    const label =
      link.kind === "UNLOCK" ? "unlocks" : link.kind === "SEED" ? "grows it" : `×${link.quantity} · ${getSkillLabel(link.skill)}`;
    byTarget.set(link.to, [...(byTarget.get(link.to) ?? []), label]);
  }
  return [...byTarget].map(([to, labels]) => ({ to, label: labels.join(", ") }));
}

function SourceRow(props: {
  graph: ItemGraph;
  source: ItemSource;
  onSelect: (itemId: number) => void;
  onEdit: () => void;
  onLocations: (recipeId: number) => void;
}) {
  const { source, graph } = props;
  const Icon = SOURCE_ICONS[source.kind];
  let title: React.ReactNode;
  let detail: React.ReactNode = null;
  let href: string | null = null;
  switch (source.kind) {
    case "CRAFTED":
    case "GATHERED": {
      const { recipe } = source;
      title = <SkillLabel skill={recipe.skill} level={recipe.requiredSkillLevel} />;
      detail = (
        <>
          {formatDuration(recipe.defaultSeconds)} · makes {recipe.yieldPerUnit} · {recipe.xpPerUnit} XP ·{" "}
          <button
            type="button"
            onClick={() => props.onLocations(recipe.id)}
            className={cn("inline-flex items-center gap-0.5 hover:text-white", recipe.locationIds.length === 0 && "text-red-300")}
          >
            <MapPin className="h-3 w-3" />
            {recipe.locationIds.length === 0 ? "no location" : `${recipe.locationIds.length} location${recipe.locationIds.length === 1 ? "" : "s"}`}
          </button>
        </>
      );
      href = `/admin/vocations/${recipe.id}`;
      break;
    }
    case "GROWN": {
      const seed = graph.items.get(source.seedItemId);
      title = (
        <button type="button" className="hover:underline" onClick={() => props.onSelect(source.seedItemId)}>
          Grown from {seed?.name ?? "a seed"}
        </button>
      );
      detail = `${source.min}–${source.max} per harvest${source.available ? "" : " · seed has no grow or harvest time"}`;
      href = `/admin/items/${source.seedItemId}`;
      break;
    }
    case "DROPPED":
      title = `${source.drop.creatureName} drops it`;
      detail = `${formatNumber(source.drop.chance * 100)}% · ×${source.drop.min}–${source.drop.max} · ${
        source.drop.places.length > 0 ? source.drop.places.join(", ") : "roams nowhere"
      }`;
      href = source.drop.creatureKind === "ANIMAL" ? "/admin/hunting" : "/admin/dungeons";
      break;
    case "SOLD":
      title = `${source.offer.npcName}, ${source.offer.settlementName}`;
      detail = [
        `${formatNumber(source.offer.price)} gold`,
        source.offer.limited ? "rare find" : null,
        source.offer.gated ? "after a community project" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      href = `/admin/npcs/${source.offer.npcId}`;
      break;
    case "QUEST":
      title = `Quest "${source.reward.questName}"`;
      detail = `×${source.reward.quantity}`;
      href = `/admin/npcs/${source.reward.npcId}`;
      break;
  }
  return (
    <div className={cn("flex gap-2.5 rounded-md bg-white/[0.03] px-2.5 py-2", !source.available && "opacity-60")}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-label={SOURCE_LABELS[source.kind]} />
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-white/85">
          {title}
          {!source.available ? <span className="rounded bg-red-400/15 px-1 text-[10px] text-red-300">off</span> : null}
        </div>
        {detail ? <div className="mt-0.5 text-white/50">{detail}</div> : null}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {source.kind === "CRAFTED" || source.kind === "GATHERED" ? (
          <RowAction label="Edit recipe here" onClick={props.onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </RowAction>
        ) : null}
        {href ? (
          <Link href={href} target="_blank" aria-label="Open in its editor" title="Open in its editor" className="grid h-6 w-6 place-items-center rounded text-white/40 hover:bg-white/10 hover:text-white">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ItemRow(props: {
  graph: ItemGraph;
  itemId: number;
  onSelect: (itemId: number) => void;
  onFocus?: (itemId: number) => void;
  detail?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const item = props.graph.items.get(props.itemId);
  if (!item) return null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => props.onSelect(props.itemId)}
      onDoubleClick={() => props.onFocus?.(props.itemId)}
      onKeyDown={(event) => event.key === "Enter" && props.onSelect(props.itemId)}
      className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/[0.05]"
    >
      <ItemArt item={item} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-white/90">{item.name}</div>
        <SourceIcons graph={props.graph} itemId={props.itemId} />
      </div>
      <div className="shrink-0 text-xs">{props.detail}</div>
      {props.action ? <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">{props.action}</div> : null}
    </div>
  );
}

function RowAction(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
      className="grid h-6 w-6 place-items-center rounded text-white/50 hover:bg-white/10 hover:text-white"
    >
      {props.children}
    </button>
  );
}

function Section(props: { title: string; count: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          {props.title}
          {props.count > 0 ? <span className="ml-1.5 text-white/30">{props.count}</span> : null}
        </h3>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

function Chip(props: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{
        background: props.color ? `color-mix(in srgb, ${props.color} 16%, transparent)` : "rgba(255,255,255,0.06)",
        color: props.color ?? "rgba(255,255,255,0.7)",
      }}
    >
      {props.children}
    </span>
  );
}

function Stat(props: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-md bg-white/[0.04] px-2.5 py-1.5" title={props.hint}>
      <div className="text-[11px] text-white/45">{props.label}</div>
      <div className="text-base font-semibold tabular-nums text-white">{props.value}</div>
    </div>
  );
}
