"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Grid2X2,
  Lock,
  Search,
} from "lucide-react";
import type { CraftingRule } from "~/game/crafting";
import { getCraftingCategory } from "~/game/crafting";
import { ItemType } from "~/generated/prisma/enums";
import { ItemInfoPopover } from "~/components/game/items/ItemInfoPopover";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { SkillVocationalResource } from "./SkillVocationalResources";

type CategoryOption = {
  key: string;
  label: string;
  sprite: string;
  count: number;
};

const ALL_CATEGORIES = "__all";

function formatSeconds(seconds: number) {
  const rounded = seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(2);
  return rounded.replace(/\.0+$/, "").replace(/(\.\d+?)0+$/, "$1");
}

export default function CraftingResourceCatalog(props: {
  resources: SkillVocationalResource[];
  rule: CraftingRule;
  activeResourceId: number | null;
  userLevel: number | null;
  progressLoading: boolean;
  onSelect: (resource: SkillVocationalResource) => void;
}) {
  const {
    resources,
    rule,
    activeResourceId,
    userLevel,
    progressLoading,
    onSelect,
  } = props;
  const [category, setCategory] = useState(() => {
    const firstItemType = resources[0]?.item.itemType;
    return firstItemType
      ? getCraftingCategory(firstItemType).key
      : ALL_CATEGORIES;
  });
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const byKey = new Map<string, CategoryOption>();
    for (const resource of resources) {
      const itemType = resource.item.itemType ?? ItemType.OTHER;
      const metadata = getCraftingCategory(itemType);
      const current = byKey.get(metadata.key);
      if (current) {
        current.count += 1;
      } else {
        byKey.set(metadata.key, {
          ...metadata,
          sprite: resource.item.sprite,
          count: 1,
        });
      }
    }
    // Map insertion order follows the admin-managed resource order.
    return Array.from(byKey.values());
  }, [resources]);

  const selectedCategory = categories.find((entry) => entry.key === category);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredResources = resources.filter((resource) => {
    const itemType = resource.item.itemType ?? ItemType.OTHER;
    const categoryMatches =
      category === ALL_CATEGORIES ||
      getCraftingCategory(itemType).key === category;
    return (
      categoryMatches &&
      (normalizedQuery.length === 0 ||
        resource.name.toLowerCase().includes(normalizedQuery))
    );
  });
  const allLabel = `All ${rule.catalogNoun}`;

  return (
    <section
      className="game-crafting-browser"
      aria-label={`${rule.label} catalog`}
    >
      <div className="game-crafting-toolbar">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="game-crafting-category-trigger"
              aria-label="Choose crafting category"
            >
              <span className="game-crafting-category-art" aria-hidden="true">
                {selectedCategory ? (
                  <Image
                    src={selectedCategory.sprite}
                    alt=""
                    width={40}
                    height={40}
                  />
                ) : (
                  <Grid2X2 size={18} />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-left font-medium">
                {selectedCategory?.label ?? allLabel}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {selectedCategory?.count ?? resources.length}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuRadioGroup
              value={category}
              onValueChange={setCategory}
            >
              <DropdownMenuRadioItem
                value={ALL_CATEGORIES}
                className="gap-3 py-2"
              >
                <span className="game-crafting-category-art" aria-hidden="true">
                  <Grid2X2 size={18} />
                </span>
                <span className="flex-1">{allLabel}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {resources.length}
                </span>
              </DropdownMenuRadioItem>
              {categories.map((entry) => (
                <DropdownMenuRadioItem
                  key={entry.key}
                  value={entry.key}
                  className="gap-3 py-2"
                >
                  <span
                    className="game-crafting-category-art"
                    aria-hidden="true"
                  >
                    <Image src={entry.sprite} alt="" width={40} height={40} />
                  </span>
                  <span className="flex-1">{entry.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {entry.count}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <label className="game-crafting-search">
          <span className="sr-only">Search {rule.catalogNoun}</span>
          <Search size={16} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${rule.catalogNoun}`}
            className="h-11 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
          />
        </label>
      </div>

      {filteredResources.length > 0 ? (
        <div className="game-crafting-grid">
          {filteredResources.map((resource) => {
            const isActive = activeResourceId === resource.id;
            const isLockedByLevel =
              !progressLoading &&
              userLevel !== null &&
              userLevel < resource.requiredSkillLevel;
            const requirements = [...resource.requirements].sort(
              (a, b) =>
                Number(b.item.itemType === ItemType.BLUEPRINT) -
                Number(a.item.itemType === ItemType.BLUEPRINT),
            );

            return (
              <div
                key={resource.id}
                className="game-craft-card game-stretched-row"
                data-active={isActive}
                data-locked={isLockedByLevel}
              >
                <span className="game-craft-card-main">
                  <ItemInfoPopover
                    itemId={resource.item.id}
                    rarity={resource.rarity}
                    name={resource.name}
                  >
                    <span className="game-craft-art">
                      <Image
                        src={resource.item.sprite}
                        alt=""
                        width={80}
                        height={80}
                      />
                    </span>
                  </ItemInfoPopover>
                  <span className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="game-stretched-action block w-full truncate font-semibold text-foreground"
                      disabled={isActive}
                      aria-label={`${resource.name}, level ${resource.requiredSkillLevel}${isActive ? ", in progress" : isLockedByLevel ? ", level requirement not met" : ", view crafting requirements"}`}
                      onClick={() => !isActive && onSelect(resource)}
                    >
                      {resource.name}
                    </button>
                    <span className="mt-2 flex flex-wrap gap-1">
                      <Badge
                        className={
                          isLockedByLevel
                            ? "text-xs text-warning"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        Lv. {resource.requiredSkillLevel}
                      </Badge>
                      <Badge className="gap-1 text-xs text-muted-foreground">
                        <Clock size={11} />{" "}
                        {formatSeconds(resource.effectiveSeconds)}s
                      </Badge>
                      <Badge className="text-xs text-xp">
                        {resource.xpPerUnit} XP
                      </Badge>
                    </span>
                  </span>
                  {isLockedByLevel ? (
                    <Lock className="shrink-0 text-warning" size={16} />
                  ) : (
                    <ChevronRight className="shrink-0 text-primary" size={18} />
                  )}
                </span>

                <span
                  className="game-craft-requirements"
                  aria-label="Required materials"
                >
                  {requirements.map((requirement) => {
                    const isBlueprint =
                      requirement.item.itemType === ItemType.BLUEPRINT;
                    return (
                      <ItemInfoPopover
                        key={requirement.item.id}
                        itemId={requirement.item.id}
                        rarity={requirement.item.rarity}
                        name={requirement.item.name}
                      >
                        <span
                          className="game-craft-requirement"
                          data-blueprint={isBlueprint}
                          title={`${requirement.quantityPerUnit} × ${requirement.item.name}`}
                        >
                          <Image
                            src={requirement.item.sprite}
                            alt=""
                            width={30}
                            height={30}
                          />
                          <strong>{requirement.quantityPerUnit}</strong>
                        </span>
                      </ItemInfoPopover>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="game-empty-state">No matching {rule.catalogNoun}.</div>
      )}
    </section>
  );
}
