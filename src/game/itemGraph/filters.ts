import type { VocationalActionType } from "~/generated/prisma/enums";
import type { GraphLink, ItemGraph } from "./graph";
import type { ItemCategory, ItemRole, SourceKind } from "./taxonomy";

/** Facets shared by the graph (dim or hide) and the catalog. Empty lists match everything. */
export type GraphFilters = {
  skills: VocationalActionType[];
  sources: SourceKind[];
  categories: ItemCategory[];
  roles: ItemRole[];
  tierMin: number;
  tierMax: number | null;
  mode: "dim" | "hide";
};

export const NO_FILTERS: GraphFilters = {
  skills: [],
  sources: [],
  categories: [],
  roles: [],
  tierMin: 0,
  tierMax: null,
  mode: "dim",
};

export function activeFilterCount(filters: GraphFilters) {
  return (
    filters.skills.length +
    filters.sources.length +
    filters.categories.length +
    filters.roles.length +
    (filters.tierMin > 0 || filters.tierMax !== null ? 1 : 0)
  );
}

export function matchesFilters(graph: ItemGraph, itemId: number, filters: GraphFilters) {
  const facts = graph.facts.get(itemId);
  if (!facts) return false;
  const overlaps = <T,>(wanted: T[], have: T[]) => wanted.length === 0 || have.some((value) => wanted.includes(value));
  return (
    overlaps(filters.skills, facts.skills) &&
    overlaps(filters.sources, facts.sourceKinds) &&
    (filters.categories.length === 0 || filters.categories.includes(facts.category)) &&
    (filters.roles.length === 0 || filters.roles.includes(facts.role)) &&
    facts.tier >= filters.tierMin &&
    (filters.tierMax === null || facts.tier <= filters.tierMax)
  );
}

/** A link is off-filter when a skill filter is on and another skill does the step. */
export function linkMatchesFilters(link: GraphLink, filters: GraphFilters) {
  return filters.skills.length === 0 || filters.skills.includes(link.skill);
}
